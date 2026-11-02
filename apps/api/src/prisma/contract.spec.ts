import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const contract = readFileSync(
  new URL('./contract.prisma', import.meta.url),
  'utf8',
);

describe('marketplace expansion contract', () => {
  it.each([
    'FreelancerProfile',
    'Skill',
    'FreelancerSkill',
    'PortfolioItem',
    'ProjectCategory',
    'ProjectSkill',
    'FavoriteProject',
    'ProjectMilestone',
    'Notification',
    'ActivityLog',
    'Complaint',
  ])('contains the %s model', (model) => {
    expect(contract).toContain(`model ${model} {`);
  });

  it('keeps new project and application fields optional for old rows', () => {
    expect(contract).toContain('budgetMin Int?');
    expect(contract).toContain('budgetMax Int?');
    expect(contract).toContain('categoryId String?');
    expect(contract).toContain('portfolioItemId String?');
    expect(contract).toContain('aiScore Int?');
    expect(contract).toContain('aiReason String?');
    expect(contract).toContain('aiRankedAt TimestamptzJsDate?');
  });
});
