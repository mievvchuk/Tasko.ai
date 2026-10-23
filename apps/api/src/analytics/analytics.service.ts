import { Inject, Injectable } from '@nestjs/common';
import { ProjectsService } from '../projects/projects.service.js';
import type { CurrentUser } from '../users/users.service.js';

export function taskRisk(
  task: { status: string; priority: string; deadline: Date | null },
  now = new Date(),
) {
  if (task.status === 'DONE') return 'NONE';
  if (task.deadline && task.deadline < now) return 'OVERDUE';
  if (
    task.deadline &&
    task.deadline.getTime() - now.getTime() <= 3 * 24 * 60 * 60 * 1000
  )
    return 'NEAR_DEADLINE';
  return task.priority === 'HIGH' ? 'HIGH_PRIORITY' : 'NONE';
}

export function nearestDeadline(
  tasks: { status: string; deadline: Date | null }[],
  now = new Date(),
) {
  let nearest: Date | null = null;
  for (const task of tasks) {
    if (
      task.status !== 'DONE' &&
      task.deadline &&
      task.deadline >= now &&
      (!nearest || task.deadline < nearest)
    )
      nearest = task.deadline;
  }
  return nearest;
}

@Injectable()
export class AnalyticsService {
  constructor(
    @Inject(ProjectsService) private readonly projects: ProjectsService,
  ) {}
  private get db() {
    return this.projects.prisma.client.orm.public;
  }

  async visibleProjects(user: CurrentUser) {
    if (user.role === 'ADMIN') return this.db.Project.all();
    if (user.role === 'CLIENT')
      return this.db.Project.where({ clientId: user.id }).all();
    const memberships = await this.db.ProjectMember.where({
      userId: user.id,
    }).all();
    if (!memberships.length) return [];
    return this.db.Project.where((project) =>
      project.id.in(memberships.map((membership) => membership.projectId)),
    ).all();
  }
  async visibleTasks(user: CurrentUser) {
    const projects = await this.visibleProjects(user);
    if (!projects.length) return [];
    return this.db.Task.where((task) =>
      task.projectId.in(projects.map((project) => project.id)),
    ).all();
  }
  async dashboard(user: CurrentUser) {
    const projects = await this.visibleProjects(user);
    const tasks = await this.visibleTasks(user);
    return {
      projects: projects.length,
      activeProjects: projects.filter((project) => project.status === 'ACTIVE')
        .length,
      tasks: tasks.length,
      completedTasks: tasks.filter((task) => task.status === 'DONE').length,
      overdueTasks: tasks.filter((task) => taskRisk(task) === 'OVERDUE').length,
      nearestDeadline: nearestDeadline(tasks),
      tasksByStatus: Object.fromEntries(
        ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'].map((status) => [
          status,
          tasks.filter((task) => task.status === status).length,
        ]),
      ),
    };
  }
  async deadlines(user: CurrentUser) {
    const tasks = await this.visibleTasks(user);
    return tasks
      .filter((task) => task.deadline && task.status !== 'DONE')
      .sort((a, b) => a.deadline!.getTime() - b.deadline!.getTime())
      .slice(0, 50)
      .map((task) => ({
        id: task.id,
        projectId: task.projectId,
        title: task.title,
        deadline: task.deadline,
        status: task.status,
        priority: task.priority,
        risk: taskRisk(task),
      }));
  }
  async workload(user: CurrentUser) {
    const tasks = await this.visibleTasks(user);
    const projects = await this.visibleProjects(user);
    if (!projects.length) return [];
    const members = await this.db.ProjectMember.where((member) =>
      member.projectId.in(projects.map((project) => project.id)),
    ).all();
    const ids = [...new Set(members.map((member) => member.userId))];
    return Promise.all(
      ids.map(async (id) => {
        const person = await this.db.User.where({ id })
          .select('id', 'name')
          .first();
        const assigned = tasks.filter(
          (task) => task.assigneeId === id && task.status !== 'DONE',
        );
        assigned.sort((first, second) => {
          const firstDeadline = first.deadline?.getTime() ?? Infinity;
          const secondDeadline = second.deadline?.getTime() ?? Infinity;
          return (
            firstDeadline - secondDeadline ||
            first.title.localeCompare(second.title)
          );
        });
        return {
          user: person,
          activeTasks: assigned.length,
          overdueTasks: assigned.filter((task) => taskRisk(task) === 'OVERDUE')
            .length,
          highPriorityTasks: assigned.filter((task) => task.priority === 'HIGH')
            .length,
          nearestDeadline:
            assigned.find((task) => task.deadline)?.deadline ?? null,
          tasks: assigned.map((task) => ({
            id: task.id,
            projectId: task.projectId,
            title: task.title,
            status: task.status,
            priority: task.priority,
            deadline: task.deadline,
            risk: taskRisk(task),
          })),
        };
      }),
    );
  }
  async summary(user: CurrentUser, projectId: string) {
    const project = await this.projects.detail(user, projectId);
    const tasks = await this.db.Task.where({ projectId }).all();
    return {
      project,
      riskyTasks: tasks
        .filter((task) => taskRisk(task) !== 'NONE')
        .map((task) => ({
          id: task.id,
          title: task.title,
          status: task.status,
          priority: task.priority,
          deadline: task.deadline,
          risk: taskRisk(task),
        })),
    };
  }
}
