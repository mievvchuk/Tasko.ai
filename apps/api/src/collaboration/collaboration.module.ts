import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { TasksModule } from '../tasks/tasks.module.js';
import { CollaborationController } from './collaboration.controller.js';
import { CollaborationService } from './collaboration.service.js';
import { FilesService } from './files.service.js';

@Module({
  imports: [AuthModule, ProjectsModule, TasksModule],
  controllers: [CollaborationController],
  providers: [CollaborationService, FilesService],
  exports: [CollaborationService],
})
export class CollaborationModule {}
