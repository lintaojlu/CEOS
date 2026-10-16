import { describe, expect, it } from 'vitest';
import { classifyTurn, taskRemainder } from './turn.js';
import { noteDetailDate, readNearMilestones, readOpenDays, readReadyIdeas } from './reads.js';
import { redact } from './redact.js';
import { applyProposal } from './apply.js';
import { applyTurnOverrides, completeWriteArgs, stageWrite, validateProposal } from './writes.js';
import { AGENT_CONTEXT_TEMPLATE } from './prompt.js';
import { buildAgentContext } from './context.js';
import { tagDirective } from './tag-intent.js';

const today = '2026-10-09';
const viewed = '2026-10-08';

function gate(extra = {}) {
  return {
    allowCreate: false,
    allowRemove: false,
    capped: true,
    cap: 3,
    writableDates: [viewed, today],
    ...extra
  };
}

function world() {
  return {
    tagIds: ['tag-work'],
    ideas: [{ id: 'idea-1', text: '写引言', note: '', completed: false, dependsOn: [] }],
    readyIds: ['idea-1'],
    schedule: {
      [viewed]: {
        required: [{ id: 'keep', text: '已有必做', note: '', completed: false, tagIds: ['tag-work'], subtasks: [] }],
        optional: [{ id: 'maybe', text: '已有选做', note: '', completed: false, tagIds: [], subtasks: [] }]
      },
      '2026-10-07': {
        required: [{ id: 'past', text: '昨天的论文', note: '第三章', completed: false, tagIds: ['tag-work'], subtasks: [{ id: 's1', text: '查资料', completed: false }] }],
        optional: []
      }
    }
  };
}

describe('classifyTurn', () => {
  it('treats a bare arrange request as pure arrange', () => {
    const turn = classifyTurn('安排今天', { viewedKey: viewed, today });
    expect(turn.pureArrange).toBe(true);
    expect(turn.allowCreate).toBe(false);
    expect(turn.allowRemove).toBe(false);
    expect(turn.requiredCap).toBe(3);
    expect(turn.writableDates).toEqual([today]);
    expect(turn.writableDates).not.toContain(viewed);
  });

  it('writes today when the sentence names no date', () => {
    const turn = classifyTurn('晚上发邮件', { viewedKey: viewed, today });
    expect(turn.writableDates).toEqual([today]);
    expect(turn.allowCreate).toBe(true);
  });

  it('offers create_task when the sentence also names a new task', () => {
    const turn = classifyTurn('安排今天，另外晚上发邮件', { viewedKey: viewed, today });
    expect(taskRemainder('安排今天，另外晚上发邮件')).toBe('另外晚上发邮件');
    expect(turn.pureArrange).toBe(false);
    expect(turn.allowCreate).toBe(true);
    expect(turn.requiredCap).toBeNull();
  });

  it('allows removal and uses the spoken count', () => {
    const turn = classifyTurn('明天只留5件必做', { viewedKey: viewed, today });
    expect(turn.pureArrange).toBe(true);
    expect(turn.allowRemove).toBe(true);
    expect(turn.requiredCap).toBe(5);
    expect(turn.writableDates).toEqual(['2026-10-10']);
    expect(turn.writableDates).not.toContain(today);
    expect(turn.writableDates).not.toContain(viewed);
  });
});

describe('context and tag rewrite', () => {
  it('fills context placeholders and leaves tomorrow for the model to infer', () => {
    expect(AGENT_CONTEXT_TEMPLATE).toContain('{{today}}');
    expect(AGENT_CONTEXT_TEMPLATE).not.toContain('{{tomorrow}}');
    const text = buildAgentContext(AGENT_CONTEXT_TEMPLATE, {
      today,
      tags: [{ id: 'climb', name: '攀岩项目' }],
      schedule: {
        [today]: { required: [], optional: [] },
        '2026-10-07': { required: [{ id: 'p', text: '旧的', completed: false }], optional: [] }
      },
      ideas: [],
      milestones: [{ title: '交稿', date: '2026-10-12', completed: false }],
      writableDates: [today]
    });
    expect(text).toContain(`${today} 星期五`);
    expect(text).toContain('攀岩项目 id=climb');
    expect(text).toContain('这一天没有任务');
    expect(text).toContain('2026-10-07 1条');
    expect(text).toContain('交稿 2026-10-12');
    expect(text).not.toContain('{{');
  });

  it('forces one matched tag, clears two, and does not put a removed tag back', () => {
    const climb = { id: 'climb', name: '攀岩项目' };
    const life = { id: 'life', name: '生活' };
    const work = { id: 'work', name: '工作' };
    expect(tagDirective('今天推进攀岩', [climb])).toEqual({ mode: 'set', tagId: 'climb' });
    expect(tagDirective('攀岩项目和生活', [climb, life])).toEqual({ mode: 'clear' });
    expect(tagDirective('把攀岩的标签去掉', [climb])).toEqual({ mode: 'clear' });
    expect(tagDirective('把攀岩换成工作', [climb, work])).toEqual({ mode: 'set', tagId: 'work' });

    const base = world();
    base.tagIds = ['climb', 'work'];
    const cleared = applyTurnOverrides('update_task', {
      date: viewed, taskId: 'keep', text: '已有必做', note: '', list: 'required', tagId: 'climb', subtasks: []
    }, base, { writableDates: [viewed], tagDirective: { mode: 'clear' } });
    expect(cleared.ok).toBe(true);
    expect(cleared.args.tagId).toBe('');

    const filled = applyTurnOverrides('create_task', {
      list: 'required', text: '训练', note: '', tagId: '', subtasks: []
    }, base, { writableDates: [today], tagDirective: { mode: 'set', tagId: 'climb' } });
    expect(filled.ok).toBe(true);
    expect(filled.args.date).toBe(today);
    expect(filled.args.tagId).toBe('climb');

    const missing = applyTurnOverrides('create_task', {
      list: 'required', text: '训练', note: '', tagId: '', subtasks: []
    }, base, { writableDates: [today, '2026-10-10'], tagDirective: { mode: 'keep' } });
    expect(missing.ok).toBe(false);
    expect(missing.error).toMatch(/允许写入/);
  });
});

describe('write gates', () => {
  it('rejects a fourth required placement and a remove without 只留', () => {
    const base = world();
    base.schedule['2026-10-07'].required.push(
      { id: 'past-2', text: '第二件', note: '', completed: false, tagIds: [], subtasks: [] },
      { id: 'past-3', text: '第三件', note: '', completed: false, tagIds: [], subtasks: [] }
    );
    let staged = [];
    for (const taskId of ['past', 'past-2', 'past-3']) {
      const result = stageWrite(staged, {
        id: taskId,
        name: 'copy_open_task',
        args: completeWriteArgs('copy_open_task', {
          sourceDate: '2026-10-07',
          taskId,
          date: today,
          list: 'required',
          tagId: '',
          text: taskId,
          note: '',
          subtasks: []
        }, base),
        ...gate()
      }, base);
      expect(result.ok).toBe(true);
      staged = result.staged;
    }
    const fourth = stageWrite(staged, {
      id: 'c4',
      name: 'pickup_idea',
      args: completeWriteArgs('pickup_idea', {
        ideaId: 'idea-1', date: today, list: 'required', tagId: 'tag-work', text: '写引言', note: '', subtasks: []
      }, base),
      ...gate()
    }, base);
    expect(fourth.ok).toBe(false);

    const removal = stageWrite(staged, {
      id: 'rm',
      name: 'remove_task',
      args: completeWriteArgs('remove_task', { date: viewed, taskId: 'keep' }, base),
      ...gate({ allowRemove: false })
    }, base);
    expect(removal.ok).toBe(false);
    expect(removal.error).toMatch(/不能删除/);
  });

  it('rejects create_task during pure arrange and an unknown tag', () => {
    const base = world();
    const created = stageWrite([], {
      id: 'new',
      name: 'create_task',
      args: completeWriteArgs('create_task', {
        date: today, list: 'required', text: '晚上发邮件', note: '', tagId: '', subtasks: []
      }, base),
      ...gate({ allowCreate: false })
    }, base);
    expect(created.ok).toBe(false);

    const tagged = stageWrite([], {
      id: 'up',
      name: 'update_task',
      args: completeWriteArgs('update_task', {
        date: viewed, taskId: 'keep', text: '已有必做', note: '', list: 'required', tagId: 'missing', subtasks: []
      }, base),
      ...gate()
    }, base);
    expect(tagged.ok).toBe(false);
    expect(tagged.error).toMatch(/标签/);
  });

  it('clears a tag when tagId is empty and keeps an existing required task out of the cap', () => {
    const base = world();
    const staged = [{
      id: 'up',
      name: 'update_task',
      args: { date: viewed, taskId: 'keep', text: '已有必做', note: '', list: 'required', tagId: '', subtasks: [] },
      ...gate()
    }];
    expect(validateProposal(staged, base).ok).toBe(true);
  });
});

describe('applyProposal', () => {
  it('copies one unfinished task, picks up an idea, and leaves the source day', () => {
    const draft = {
      schedule: world().schedule,
      ideas: [
        { id: 'idea-1', text: '写引言', note: '注', completed: false, dependsOn: [], pinned: false },
        { id: 'idea-2', text: '后继', note: '', completed: false, dependsOn: [{ scope: 'idea', id: 'idea-1' }], pinned: false }
      ]
    };
    const calls = [
      {
        id: 'copy',
        name: 'copy_open_task',
        args: {
          sourceDate: '2026-10-07', taskId: 'past', date: today, list: 'required',
          tagId: '', text: '昨天的论文', note: '第三章', subtasks: ['查资料']
        }
      },
      {
        id: 'pick',
        name: 'pickup_idea',
        args: {
          ideaId: 'idea-1', date: today, list: 'optional', tagId: 'tag-work',
          text: '写引言', note: '注', subtasks: []
        }
      }
    ];
    expect(applyProposal(draft, calls).ok).toBe(true);
    expect(draft.schedule['2026-10-07'].required.map((task) => task.id)).toEqual(['past']);
    expect(draft.schedule['2026-10-07'].required[0].tagIds).toEqual(['tag-work']);
    const copied = draft.schedule[today].required.find((task) => task.id === 'past');
    expect(copied.tagIds).toEqual([]);
    expect(copied.text).toBe('昨天的论文');
    expect(draft.schedule[today].optional.map((task) => task.text)).toEqual(['写引言']);
    expect(draft.ideas.map((idea) => idea.id)).toEqual(['idea-2']);
    expect(draft.ideas[0].text).toBe('后继');
  });

  it('writes nothing when a later call fails', () => {
    const draft = {
      schedule: { [today]: { required: [], optional: [] } },
      ideas: []
    };
    const result = applyProposal(draft, [
      {
        id: 'ok',
        name: 'create_task',
        args: { date: today, list: 'required', text: '甲', note: '', tagId: '', subtasks: [] }
      },
      {
        id: 'bad',
        name: 'update_task',
        args: { date: today, taskId: 'missing', text: '乙', note: '', list: 'required', tagId: '', subtasks: [] }
      }
    ]);
    expect(result.ok).toBe(false);
    expect(result.index).toBe(1);
    expect(draft.schedule[today].required).toEqual([]);
  });

  it('creates and updates an idea without a schedule date', () => {
    const base = world();
    const created = applyTurnOverrides('create_idea', {
      text: '新灵感', note: '正文'
    }, base, { writableDates: [] });
    expect(created.ok).toBe(true);
    const draft = { schedule: structuredClone(base.schedule), ideas: structuredClone(base.ideas) };
    expect(applyProposal(draft, [{ id: 'c1', name: 'create_idea', args: created.args }]).ok).toBe(true);
    expect(draft.ideas.some((idea) => idea.title === '新灵感' && idea.body === '新灵感\n\n正文')).toBe(true);

    const updated = applyTurnOverrides('update_idea', {
      ideaId: 'idea-1', text: '改标题', note: '# 正文', completed: true
    }, base, { writableDates: [] });
    expect(updated.ok).toBe(true);
    const next = { schedule: structuredClone(base.schedule), ideas: structuredClone(base.ideas) };
    expect(applyProposal(next, [{ id: 'u1', name: 'update_idea', args: updated.args }]).ok).toBe(true);
    expect(next.ideas.find((idea) => idea.id === 'idea-1')).toMatchObject({
      title: '改标题',
      body: '改标题\n\n# 正文',
      completed: true
    });
    const ready = readReadyIdeas(base.ideas, base.schedule, today, today);
    expect(ready[0]).toEqual({ id: 'idea-1', text: '写引言' });
  });
});

describe('reads and redact', () => {
  it('limits open-task detail to seven dates and keeps near milestones', () => {
    let used = [];
    for (let i = 0; i < 7; i += 1) {
      const next = noteDetailDate(used, `2026-10-0${i + 1}`);
      expect(next.ok).toBe(true);
      used = next.used;
    }
    expect(noteDetailDate(used, '2026-10-20').ok).toBe(false);
    expect(noteDetailDate(used, '2026-10-01').ok).toBe(true);

    const schedule = {
      [viewed]: { required: [{ id: 'a', text: '今天的', completed: false }], optional: [] },
      '2026-10-01': { required: [{ id: 'b', text: '旧的', completed: false }, { id: 'c', text: '完成了', completed: true }], optional: [] }
    };
    expect(readOpenDays(schedule, viewed)).toEqual([{ date: '2026-10-01', openCount: 1, titles: ['旧的'] }]);
    expect(readNearMilestones([
      { title: '近', date: '2026-10-20', completed: false },
      { title: '远', date: '2026-12-01', completed: false },
      { title: '过', date: '2026-10-01', completed: false }
    ], today).map((item) => item.title)).toEqual(['近', '过']);
  });

  it('drops secrets from a log payload', () => {
    expect(redact({
      apiKey: 'sk-test',
      baseUrl: 'https://example.com',
      nested: { Authorization: 'Bearer sk-test' },
      text: 'Authorization: Bearer sk-live'
    })).toEqual({
      nested: {},
      text: 'Authorization: Bearer [redacted]'
    });
  });
});
