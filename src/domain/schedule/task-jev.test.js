import { describe, expect, it } from 'vitest';
import { JEV_QUESTIONS, jevState, needsAction } from './task-jev.js';

describe('jevState', () => {
  it('keeps only text, in the given order', () => {
    expect(jevState({
      title: '  下午对一下菜单  ',
      notes: ['先画菜单', '  ', '再接保存'],
      projects: ['日程', '生活']
    })).toEqual({
      title: '下午对一下菜单',
      notes: ['先画菜单', '再接保存'],
      projects: ['日程', '生活']
    });
  });

  it('uses empty lists when there are no notes or projects', () => {
    expect(jevState({ title: '写计划' })).toEqual({
      title: '写计划',
      notes: [],
      projects: []
    });
  });
});

describe('needsAction', () => {
  it('acts only when a noul is at least one half', () => {
    expect(needsAction({ type: 'noul', noul: 0.5 })).toBe(true);
    expect(needsAction({ type: 'noul', noul: 0.95 })).toBe(true);
    expect(needsAction({ type: 'noul', noul: 0.49 })).toBe(false);
    expect(needsAction({ type: 'noul', noul: 0 })).toBe(false);
  });

  it('skips a missing, mistyped, or non-finite answer', () => {
    expect(needsAction(undefined)).toBe(false);
    expect(needsAction({ type: 'choice', choice: 'yes', noul: 0.9 })).toBe(false);
    expect(needsAction({ type: 'noul', noul: '0.9' })).toBe(false);
    expect(needsAction({ type: 'noul', noul: Number.NaN })).toBe(false);
  });
});

describe('JEV_QUESTIONS', () => {
  it('asks both decisions as nouls about the same state', () => {
    expect(JEV_QUESTIONS.standardize.type).toBe('noul');
    expect(JEV_QUESTIONS.standardize.criteria.true).toContain('20 个字');
    expect(JEV_QUESTIONS.breakdown.type).toBe('noul');
    expect(JEV_QUESTIONS.breakdown.instructions).toContain('人类任务');
  });
});
