import React, { useState } from 'react';
import { normalizeSubtasks } from '../../../domain/schedule/daily-task.js';
import { useApp } from '../../app/context.jsx';
import { Card } from '../../components/Card.jsx';
import { Checkbox } from '../../components/Checkbox.jsx';
import { Modal } from '../../components/Modal.jsx';
import { TaskText } from './TaskText.jsx';

export function ProjectsCard() {
  const app = useApp();
  const projects = app.scheduleService.workspace.projects || [];
  const [open, setOpen] = useState(() => new Set());
  const [taskOpen, setTaskOpen] = useState(() => new Set());
  const [editingId, setEditingId] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const editing = projects.find((project) => project.id === editingId) || null;
  const taskEdit = editingTask
    ? (projects.find((project) => project.id === editingTask.projectId)?.tasks || []).find((task) => task.id === editingTask.taskId) || null
    : null;

  function toggle(set, id) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  }

  return (
    <Card title="项目" note="项目全局保存。从这里添加的任务会进入当前查看日的必做。">
      <div className="list-scroll">
        {projects.length === 0 ? <p className="empty">还没有项目。</p> : null}
        {projects.map((project) => {
          const tasks = project.tasks || [];
          const done = tasks.filter((task) => task.completed).length;
          const expanded = open.has(project.id);
          return (
            <div key={project.id} className="task-block">
              <div className="task-row">
                <button type="button" className={expanded ? 'chevron is-open' : 'chevron'} onClick={() => setOpen((value) => toggle(value, project.id))}>›</button>
                <span className="task-title" style={{ flex: 1 }} title="双击编辑" onDoubleClick={() => setEditingId(project.id)}>{project.name}</span>
                {tasks.length ? <span className="chip">{done}/{tasks.length}</span> : null}
              </div>
              {expanded ? (
                <div className="subtasks">
                  <div className="sub-row">
                    <input className="field" placeholder="添加任务，回车进入今日必做" onKeyDown={(event) => {
                      if (event.key !== 'Enter') return;
                      const text = event.currentTarget.value.trim();
                      if (!text) return;
                      setOpen((value) => new Set(value).add(project.id));
                      app.scheduleService.addProjectTask(project.id, text);
                      event.currentTarget.value = '';
                    }} />
                  </div>
                  {tasks.map((task) => {
                    const subs = normalizeSubtasks(task.subtasks);
                    const showSubs = taskOpen.has(task.id);
                    return (
                      <div key={task.id}>
                        <div className="sub-row">
                          <button type="button" className={showSubs ? 'chevron is-open' : 'chevron'} onClick={() => setTaskOpen((value) => toggle(value, task.id))}>›</button>
                          <Checkbox checked={task.completed} onChange={() => app.scheduleService.toggleProjectTask(project.id, task.id)} />
                          <span style={{ flex: 1, minWidth: 0 }} title="双击编辑" onDoubleClick={() => setEditingTask({ projectId: project.id, taskId: task.id })}>
                            <TaskText text={task.text} done={task.completed} />
                          </span>
                        </div>
                        {showSubs ? (
                          <div className="subtasks">
                            <div className="sub-row">
                              <input className="field" placeholder="添加子任务，回车确认" onKeyDown={(event) => {
                                if (event.key !== 'Enter') return;
                                const text = event.currentTarget.value.trim();
                                if (!text) return;
                                app.scheduleService.addProjectSubtask(project.id, task.id, text);
                                event.currentTarget.value = '';
                              }} />
                            </div>
                            {subs.map((sub) => (
                              <div key={sub.id} className="sub-row">
                                <Checkbox checked={sub.completed} onChange={() => app.scheduleService.toggleProjectSubtask(project.id, task.id, sub.id)} />
                                <span className={sub.completed ? 'is-done' : ''}>{sub.text}</span>
                                <button type="button" className="btn btn-quiet btn-danger btn-mono" onClick={() => app.scheduleService.deleteProjectSubtask(project.id, task.id, sub.id)}>删除</button>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      {editing ? <ProjectEditModal project={editing} onClose={() => setEditingId(null)} /> : null}
      {editingTask && taskEdit ? (
        <ProjectTaskEditModal
          projectId={editingTask.projectId}
          task={taskEdit}
          onClose={() => setEditingTask(null)}
        />
      ) : null}
    </Card>
  );
}

function ProjectTaskEditModal({ projectId, task, onClose }) {
  const app = useApp();
  const [text, setText] = useState(task.text || '');
  const [note, setNote] = useState(task.note || '');

  function save() {
    if (!app.scheduleService.updateProjectTask(projectId, task.id, { text, note })) {
      window.alert('内容不能为空');
      return;
    }
    onClose();
  }

  function onFormKeyDown(event) {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    if (event.target.tagName === 'BUTTON') return;
    event.preventDefault();
    save();
  }

  return (
    <Modal title="编辑任务" onClose={onClose}>
      <form className="form-stack" onSubmit={(event) => { event.preventDefault(); save(); }} onKeyDown={onFormKeyDown}>
        <label className="field-label">内容
          <input className="field" value={text} onChange={(event) => setText(event.target.value)} />
        </label>
        <label className="field-label">说明
          <textarea className="textarea" value={note} onChange={(event) => setNote(event.target.value)} />
        </label>
        <div className="form-actions">
          <button type="button" className="btn btn-danger" onClick={() => {
            app.scheduleService.deleteProjectTask(projectId, task.id);
            onClose();
          }}>删除</button>
          <button type="button" className="btn" onClick={onClose}>取消</button>
          <button type="submit" className="btn btn-primary">保存</button>
        </div>
      </form>
    </Modal>
  );
}

function ProjectEditModal({ project, onClose }) {
  const app = useApp();
  const [name, setName] = useState(project.name);

  function save() {
    if (!app.scheduleService.renameProject(project.id, name)) {
      window.alert('名称无效，或已有同名项目');
      return;
    }
    onClose();
  }

  function remove() {
    if (!window.confirm(`删除项目「${project.name}」以及它在当前查看日里的任务？`)) return;
    app.scheduleService.deleteProject(project.id);
    onClose();
  }

  return (
    <Modal title="编辑项目" onClose={onClose}>
      <div className="form-stack">
        <label className="field-label">名称
          <input className="field" value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <div className="form-actions">
          <button type="button" className="btn btn-danger" onClick={remove}>删除</button>
          <button type="button" className="btn" onClick={onClose}>取消</button>
          <button type="button" className="btn btn-primary" onClick={save}>保存</button>
        </div>
      </div>
    </Modal>
  );
}
