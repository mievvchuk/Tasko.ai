import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Actor } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { CurrentUser } from '../users/users.service.js';
import { PageDto } from '../projects/projects.dto.js';
import {
  BoardColumnDto,
  CreateTaskDto,
  OrderStatusDto,
  TaskQueryDto,
  TaskStatusDto,
  UpdateTaskDto,
} from './tasks.dto.js';
import { TasksService } from './tasks.service.js';

@ApiTags('Tasks and orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class TasksController {
  constructor(@Inject(TasksService) private readonly tasks: TasksService) {}
  @Get('projects/:id/tasks') list(
    @Actor() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() filters: TaskQueryDto,
  ) {
    return this.tasks.list(user, id, filters);
  }
  @Post('projects/:id/tasks') create(
    @Actor() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: CreateTaskDto,
  ) {
    return this.tasks.create(user, id, data);
  }
  @Get('tasks/:id') detail(
    @Actor() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tasks.find(user, id);
  }
  @Patch('tasks/:id') update(
    @Actor() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: UpdateTaskDto,
  ) {
    return this.tasks.update(user, id, data);
  }
  @Patch('tasks/:id/status') status(
    @Actor() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: TaskStatusDto,
  ) {
    return this.tasks.status(user, id, data.status, data.columnId);
  }
  @Get('projects/:id/columns') columns(
    @Actor() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tasks.columns(user, id);
  }
  @Post('projects/:id/columns') addColumn(
    @Actor() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: BoardColumnDto,
  ) {
    return this.tasks.addColumn(user, id, data.title, data.status);
  }
  @Delete('columns/:id') deleteColumn(
    @Actor() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tasks.deleteColumn(user, id);
  }
  @Get('projects/:id/orders') orders(
    @Actor() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() page: PageDto,
  ) {
    return this.tasks.orders(user, id, page);
  }
  @Post('projects/:id/orders') order(
    @Actor() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tasks.createOrder(user, id);
  }
  @Patch('orders/:id') updateOrder(
    @Actor() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: OrderStatusDto,
  ) {
    return this.tasks.updateOrder(user, id, data.status);
  }
}
