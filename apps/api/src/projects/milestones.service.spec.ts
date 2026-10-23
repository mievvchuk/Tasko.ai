import { ConflictException } from '@nestjs/common';
import { checkMilestoneTransition } from './milestones.service.js';

describe('checkMilestoneTransition', () => {
  it('allows the normal workflow', () => {
    expect(() =>
      checkMilestoneTransition('PLANNED', 'IN_PROGRESS'),
    ).not.toThrow();
    expect(() =>
      checkMilestoneTransition('IN_PROGRESS', 'REVIEW'),
    ).not.toThrow();
    expect(() => checkMilestoneTransition('REVIEW', 'COMPLETED')).not.toThrow();
  });
  it('rejects skipped workflow states', () => {
    expect(() => checkMilestoneTransition('PLANNED', 'COMPLETED')).toThrow(
      ConflictException,
    );
  });
});
