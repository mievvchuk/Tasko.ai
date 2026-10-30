import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { AnalyticsModule } from '../analytics/analytics.module.js';
import { TasksModule } from '../tasks/tasks.module.js';
import { CollaborationModule } from '../collaboration/collaboration.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { AgentController } from './agent.controller.js';
import { AgentService } from './agent.service.js';
import { McpService } from './mcp.service.js';
import { ProjectPlanningService } from './project-planning.service.js';

@Module({
  imports: [
    AuthModule,
    ProjectsModule,
    AnalyticsModule,
    TasksModule,
    CollaborationModule,
    NotificationsModule,
  ],
  controllers: [AgentController],
  providers: [AgentService, McpService, ProjectPlanningService],
  exports: [McpService],
})
export class AgentModule {}
