import { moveRule } from '../../../src/tasks/task-workflow.js';

const owner = { isOwner: true, isAssignee: false, isMember: false };
const assignee = { isOwner: false, isAssignee: true, isMember: true };
const otherFreelancer = { isOwner: false, isAssignee: false, isMember: true };
const stranger = { isOwner: false, isAssignee: false, isMember: false };
const assigned = (status: string) => ({ status, assigneeId: 'f1' });
const free = (status: string) => ({ status, assigneeId: null });

describe('task workflow', () => {
  it('lets the freelancer take a task into work and move it between work columns', () => {
    expect(moveRule(assigned('TODO'), 'IN_PROGRESS', assignee)).toEqual({
      allowed: true,
    });
    expect(moveRule(assigned('IN_PROGRESS'), 'IN_PROGRESS', assignee)).toEqual({
      allowed: true,
    });
  });
  it('lets a member take a free task, but not another freelancer’s task', () => {
    expect(moveRule(free('TODO'), 'IN_PROGRESS', otherFreelancer)).toEqual({
      allowed: true,
      takes: true,
    });
    expect(moveRule(assigned('TODO'), 'IN_PROGRESS', otherFreelancer).allowed).toBe(false);
    expect(moveRule(free('TODO'), 'IN_PROGRESS', stranger).allowed).toBe(false);
  });
  it('requires a comment to submit and only the assignee submits', () => {
    expect(moveRule(assigned('IN_PROGRESS'), 'REVIEW', assignee)).toEqual({
      allowed: true,
      needs: 'comment',
    });
    expect(moveRule(assigned('IN_PROGRESS'), 'REVIEW', owner).allowed).toBe(false);
  });
  it('never lets the freelancer complete a task by themselves', () => {
    expect(moveRule(assigned('IN_PROGRESS'), 'DONE', assignee).allowed).toBe(false);
    expect(moveRule(assigned('REVIEW'), 'DONE', assignee).allowed).toBe(false);
    expect(moveRule(assigned('REVIEW'), 'REVISION', assignee).allowed).toBe(false);
  });
  it('lets the client accept or return work with a reason', () => {
    expect(moveRule(assigned('REVIEW'), 'DONE', owner)).toEqual({
      allowed: true,
    });
    expect(moveRule(assigned('REVIEW'), 'REVISION', owner)).toEqual({
      allowed: true,
      needs: 'reason',
    });
    expect(moveRule(assigned('DONE'), 'REVISION', owner)).toEqual({
      allowed: true,
      needs: 'reason',
    });
  });
  it('lets the freelancer resume a returned task', () => {
    expect(moveRule(assigned('REVISION'), 'IN_PROGRESS', assignee)).toEqual({
      allowed: true,
    });
    expect(moveRule(assigned('REVISION'), 'IN_PROGRESS', otherFreelancer).allowed).toBe(false);
  });
  it('lets the client finish a task they run without a freelancer', () => {
    expect(moveRule(free('IN_PROGRESS'), 'DONE', owner)).toEqual({
      allowed: true,
    });
    expect(moveRule(assigned('IN_PROGRESS'), 'DONE', owner).allowed).toBe(false);
  });
  it('refuses skipped steps', () => {
    expect(moveRule(assigned('TODO'), 'REVIEW', assignee).allowed).toBe(false);
    expect(moveRule(assigned('TODO'), 'DONE', owner).allowed).toBe(false);
    expect(moveRule(assigned('DONE'), 'IN_PROGRESS', owner).allowed).toBe(false);
  });
});
