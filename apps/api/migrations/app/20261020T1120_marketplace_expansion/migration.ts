#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/be069b2486bc945c0cbb73b5e440256e245f05f3781e766980eba0e66effef92/contract';
import endContract from '../../snapshots/be069b2486bc945c0cbb73b5e440256e245f05f3781e766980eba0e66effef92/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/fa37196087c750275ca221ca72aed47e9229d9c9d68c6e9164ab83938567a992/contract';
import startContract from '../../snapshots/fa37196087c750275ca221ca72aed47e9229d9c9d68c6e9164ab83938567a992/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'ActivityLog',
        columns: [
          col('actorId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('message', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('projectId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'Complaint',
        columns: [
          col('adminNote', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
          col('description', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('projectId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('reason', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('reporterId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('targetUserId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'FavoriteProject',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
          col('projectId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['userId', 'projectId'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'FreelancerProfile',
        columns: [
          col('availability', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('bio', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('hourlyRate', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['userId'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'FreelancerSkill',
        columns: [
          col('skillId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['userId', 'skillId'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'Notification',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('message', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('projectId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('readAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-date@1' } }),
          col('taskId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'PortfolioItem',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('title', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
          col('url', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'ProjectCategory',
        columns: [
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'ProjectMilestone',
        columns: [
          col('amount', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
          col('deadline', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-date@1' } }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('paymentStatus', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('position', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('projectId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('title', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'ProjectSkill',
        columns: [
          col('projectId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('skillId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['projectId', 'skillId'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'Skill',
        columns: [
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'Project',
        column: col('budgetMax', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Project',
        column: col('budgetMin', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Project',
        column: col('categoryId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'ProjectApplication',
        column: col('aiRankedAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-date@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'ProjectApplication',
        column: col('aiReason', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'ProjectApplication',
        column: col('aiScore', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'ProjectApplication',
        column: col('portfolioItemId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'ProjectCategory',
        constraint: 'ProjectCategory_name_key',
        columns: ['name'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'ProjectMilestone',
        constraint: 'ProjectMilestone_projectId_position_key',
        columns: ['projectId', 'position'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Skill',
        constraint: 'Skill_name_key',
        columns: ['name'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ActivityLog',
        index: 'ActivityLog_actorId_idx_a58f6b4b',
        columns: ['actorId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ActivityLog',
        index: 'ActivityLog_projectId_idx_a96e4d92',
        columns: ['projectId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Complaint',
        index: 'Complaint_projectId_idx_a96e4d92',
        columns: ['projectId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Complaint',
        index: 'Complaint_reporterId_idx_aa245831',
        columns: ['reporterId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Complaint',
        index: 'Complaint_targetUserId_idx_e0d638f0',
        columns: ['targetUserId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'FavoriteProject',
        index: 'FavoriteProject_projectId_idx_a96e4d92',
        columns: ['projectId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'FavoriteProject',
        index: 'FavoriteProject_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'FreelancerSkill',
        index: 'FreelancerSkill_skillId_idx_6e19993d',
        columns: ['skillId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'FreelancerSkill',
        index: 'FreelancerSkill_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Notification',
        index: 'Notification_projectId_idx_a96e4d92',
        columns: ['projectId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Notification',
        index: 'Notification_taskId_idx_4965c936',
        columns: ['taskId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Notification',
        index: 'Notification_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'PortfolioItem',
        index: 'PortfolioItem_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Project',
        index: 'Project_categoryId_idx_15c304f2',
        columns: ['categoryId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ProjectApplication',
        index: 'ProjectApplication_portfolioItemId_idx_8c3f55d5',
        columns: ['portfolioItemId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ProjectMilestone',
        index: 'ProjectMilestone_projectId_idx_a96e4d92',
        columns: ['projectId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ProjectSkill',
        index: 'ProjectSkill_projectId_idx_a96e4d92',
        columns: ['projectId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ProjectSkill',
        index: 'ProjectSkill_skillId_idx_6e19993d',
        columns: ['skillId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ActivityLog',
        foreignKey: {
          name: 'ActivityLog_projectId_fkey',
          columns: ['projectId'],
          references: { schema: 'public', table: 'Project', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ActivityLog',
        foreignKey: {
          name: 'ActivityLog_actorId_fkey',
          columns: ['actorId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Complaint',
        foreignKey: {
          name: 'Complaint_reporterId_fkey',
          columns: ['reporterId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Complaint',
        foreignKey: {
          name: 'Complaint_targetUserId_fkey',
          columns: ['targetUserId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Complaint',
        foreignKey: {
          name: 'Complaint_projectId_fkey',
          columns: ['projectId'],
          references: { schema: 'public', table: 'Project', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'FavoriteProject',
        foreignKey: {
          name: 'FavoriteProject_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'FavoriteProject',
        foreignKey: {
          name: 'FavoriteProject_projectId_fkey',
          columns: ['projectId'],
          references: { schema: 'public', table: 'Project', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'FreelancerProfile',
        foreignKey: {
          name: 'FreelancerProfile_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'FreelancerSkill',
        foreignKey: {
          name: 'FreelancerSkill_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'FreelancerSkill',
        foreignKey: {
          name: 'FreelancerSkill_skillId_fkey',
          columns: ['skillId'],
          references: { schema: 'public', table: 'Skill', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Notification',
        foreignKey: {
          name: 'Notification_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Notification',
        foreignKey: {
          name: 'Notification_projectId_fkey',
          columns: ['projectId'],
          references: { schema: 'public', table: 'Project', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Notification',
        foreignKey: {
          name: 'Notification_taskId_fkey',
          columns: ['taskId'],
          references: { schema: 'public', table: 'Task', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'PortfolioItem',
        foreignKey: {
          name: 'PortfolioItem_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ProjectApplication',
        foreignKey: {
          name: 'ProjectApplication_portfolioItemId_fkey',
          columns: ['portfolioItemId'],
          references: { schema: 'public', table: 'PortfolioItem', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Project',
        foreignKey: {
          name: 'Project_categoryId_fkey',
          columns: ['categoryId'],
          references: { schema: 'public', table: 'ProjectCategory', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ProjectMilestone',
        foreignKey: {
          name: 'ProjectMilestone_projectId_fkey',
          columns: ['projectId'],
          references: { schema: 'public', table: 'Project', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ProjectSkill',
        foreignKey: {
          name: 'ProjectSkill_projectId_fkey',
          columns: ['projectId'],
          references: { schema: 'public', table: 'Project', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ProjectSkill',
        foreignKey: {
          name: 'ProjectSkill_skillId_fkey',
          columns: ['skillId'],
          references: { schema: 'public', table: 'Skill', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
