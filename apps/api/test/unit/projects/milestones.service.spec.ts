import { ConflictException } from '@nestjs/common';
import { checkMilestoneTransition } from '../../../src/projects/milestones.service.js';
import {
  milestoneStatusFor,
  projectIsDone,
} from '../../../src/projects/milestone-progress.js';

describe('checkMilestoneTransition', () => {
  it('lets the client accept a milestone whose tasks are done', () => {
    expect(() => checkMilestoneTransition('REVIEW', 'COMPLETED')).not.toThrow();
  });
  it('rejects manual status changes — they follow the tasks', () => {
    for (const [from, to] of [
      ['PLANNED', 'IN_PROGRESS'],
      ['IN_PROGRESS', 'REVIEW'],
      ['PLANNED', 'COMPLETED'],
      ['REVIEW', 'IN_PROGRESS'],
    ])
      expect(() => checkMilestoneTransition(from, to)).toThrow(
        ConflictException,
      );
  });
});

describe('milestoneStatusFor', () => {
  it('derives the milestone status from its tasks', () => {
    expect(milestoneStatusFor('PLANNED', [])).toBe('PLANNED');
    expect(milestoneStatusFor('PLANNED', ['TODO', 'TODO'])).toBe('PLANNED');
    expect(milestoneStatusFor('PLANNED', ['TODO', 'IN_PROGRESS'])).toBe(
      'IN_PROGRESS',
    );
    // Усі завдання прийнято — етап завершено (і вважається оплаченим)
    expect(milestoneStatusFor('IN_PROGRESS', ['DONE', 'DONE'])).toBe(
      'COMPLETED',
    );
  });
  it('returns a milestone under review to work when a task reopens', () => {
    expect(milestoneStatusFor('REVIEW', ['DONE', 'REVIEW'])).toBe(
      'IN_PROGRESS',
    );
  });
  it('never changes an accepted milestone', () => {
    expect(milestoneStatusFor('COMPLETED', ['TODO'])).toBe('COMPLETED');
  });
});

describe('projectIsDone', () => {
  it('completes a project only when every task and milestone is finished', () => {
    expect(projectIsDone(['DONE', 'DONE'], ['COMPLETED'])).toBe(true);
    expect(projectIsDone(['DONE'], [])).toBe(true);
    expect(projectIsDone(['DONE', 'REVIEW'], ['COMPLETED'])).toBe(false);
    expect(projectIsDone(['DONE'], ['COMPLETED', 'REVIEW'])).toBe(false);
    expect(projectIsDone([], [])).toBe(false);
  });
});
