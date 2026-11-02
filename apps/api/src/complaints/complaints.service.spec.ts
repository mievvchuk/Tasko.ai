import { BadRequestException } from '@nestjs/common';
import { validateComplaintTargets } from './complaints.service.js';

describe('validateComplaintTargets', () => {
  it('requires a target and rejects self complaints', () => {
    expect(() => validateComplaintTargets('u1')).toThrow(BadRequestException);
    expect(() => validateComplaintTargets('u1', 'u1')).toThrow(
      BadRequestException,
    );
    expect(() => validateComplaintTargets('u1', 'u2')).not.toThrow();
  });
});
