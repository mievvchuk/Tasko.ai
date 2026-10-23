import {
  All,
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Request, Response } from 'express';
import { Actor } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { CurrentUser } from '../users/users.service.js';
import { ApplyPlanDto, ChatDto, GeneratePlanDto } from './agent.dto.js';
import { ProjectPlanningService } from './project-planning.service.js';
import { AgentService } from './agent.service.js';
import { McpService } from './mcp.service.js';

@ApiTags('AI and MCP')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class AgentController {
  constructor(
    @Inject(AgentService) private readonly agent: AgentService,
    @Inject(McpService) private readonly mcp: McpService,
    @Inject(ProjectPlanningService)
    private readonly planning: ProjectPlanningService,
  ) {}
  @Get('agent/status') status() {
    return this.agent.status();
  }
  @Post('agent/chat') @HttpCode(200) chat(
    @Actor() user: CurrentUser,
    @Body() data: ChatDto,
  ) {
    return this.agent.chat(user, data.message);
  }
  @Post('projects/:id/applications/ai-rank')
  @HttpCode(200)
  rankApplications(
    @Actor() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.agent.rankApplications(user, id);
  }
  @Post('projects/:id/ai-plan')
  @HttpCode(200)
  generatePlan(
    @Actor() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: GeneratePlanDto,
  ) {
    return this.planning.generate(user, id, data.instructions);
  }

  @Post('projects/:id/ai-plan/apply')
  @HttpCode(200)
  applyPlan(
    @Actor() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: ApplyPlanDto,
  ) {
    return this.planning.apply(user, id, data.requestId, data.plan);
  }

  @All('mcp')
  async handleMcp(
    @Actor() user: CurrentUser,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    if (request.method !== 'POST') {
      response.setHeader('Allow', 'POST');
      response.status(405).json({ message: 'MCP підтримує лише POST.' });
      return;
    }
    const server = this.mcp.createServer(user);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(request, response, request.body);
    } finally {
      await server.close();
    }
  }
}
