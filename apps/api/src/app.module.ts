import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { HealthController } from './health/health.controller.js';
import { AuthModule } from './auth/auth.module.js';
import { ProjectsModule } from './projects/projects.module.js';
import { TasksModule } from './tasks/tasks.module.js';
import { CollaborationModule } from './collaboration/collaboration.module.js';
import { AdminModule } from './admin/admin.module.js';
import { AnalyticsModule } from './analytics/analytics.module.js';
import { AgentModule } from './agent/agent.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { ComplaintsModule } from './complaints/complaints.module.js';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AuthModule,
    ProjectsModule,
    TasksModule,
    CollaborationModule,
    AdminModule,
    AnalyticsModule,
    AgentModule,
    NotificationsModule,
    ComplaintsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
