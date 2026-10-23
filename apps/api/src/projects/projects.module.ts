import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ProjectsController } from './projects.controller.js';
import { ProjectsService } from './projects.service.js';
import { MilestonesController } from './milestones.controller.js';
import { MilestonesService } from './milestones.service.js';

@Module({
  imports: [AuthModule],
  controllers: [ProjectsController, MilestonesController],
  providers: [ProjectsService, MilestonesService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
