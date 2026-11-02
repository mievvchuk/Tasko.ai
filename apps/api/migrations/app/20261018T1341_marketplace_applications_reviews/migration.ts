#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/2f87ae5757c05633f20be2347ea1600ebc5e5e0c0f29a3b1ea5eee0bb6e634fd/contract';
import endContract from '../../snapshots/2f87ae5757c05633f20be2347ea1600ebc5e5e0c0f29a3b1ea5eee0bb6e634fd/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/abe36e5e5e10cd10242f738b8f5dbece1b4c4643eea719529748a9fc2b6bd185/contract';
import startContract from '../../snapshots/abe36e5e5e10cd10242f738b8f5dbece1b4c4643eea719529748a9fc2b6bd185/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'FreelancerReview',
        columns: [
          col('clientId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('comment', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
          col('freelancerId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('projectId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('rating', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'ProjectApplication',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
          col('freelancerId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('message', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('projectId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('proposedBudget', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('proposedDays', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('status', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'FreelancerReview',
        constraint: 'FreelancerReview_projectId_freelancerId_key',
        columns: ['projectId', 'freelancerId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'ProjectApplication',
        constraint: 'ProjectApplication_projectId_freelancerId_key',
        columns: ['projectId', 'freelancerId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'FreelancerReview',
        index: 'FreelancerReview_clientId_idx_153a9a49',
        columns: ['clientId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'FreelancerReview',
        index: 'FreelancerReview_freelancerId_idx_c8137280',
        columns: ['freelancerId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'FreelancerReview',
        index: 'FreelancerReview_projectId_idx_a96e4d92',
        columns: ['projectId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ProjectApplication',
        index: 'ProjectApplication_freelancerId_idx_c8137280',
        columns: ['freelancerId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ProjectApplication',
        index: 'ProjectApplication_projectId_idx_a96e4d92',
        columns: ['projectId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'FreelancerReview',
        foreignKey: {
          name: 'FreelancerReview_projectId_fkey',
          columns: ['projectId'],
          references: { schema: 'public', table: 'Project', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'FreelancerReview',
        foreignKey: {
          name: 'FreelancerReview_clientId_fkey',
          columns: ['clientId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'FreelancerReview',
        foreignKey: {
          name: 'FreelancerReview_freelancerId_fkey',
          columns: ['freelancerId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ProjectApplication',
        foreignKey: {
          name: 'ProjectApplication_projectId_fkey',
          columns: ['projectId'],
          references: { schema: 'public', table: 'Project', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ProjectApplication',
        foreignKey: {
          name: 'ProjectApplication_freelancerId_fkey',
          columns: ['freelancerId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
