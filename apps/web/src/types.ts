export type UserRole = "CLIENT" | "FREELANCER" | "ADMIN";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  twoFactorEnabled: boolean;
  // Посилання на фото профілю відносно API (напр. /avatars/<uuid>.jpg)
  avatarUrl?: string | null;
  createdAt?: string;
}

export interface LoginResponse {
  requiresTwoFactor: boolean;
  accessToken?: string;
  tokenType?: string;
  expiresIn?: number;
  user?: User;
}

export interface AuthSession {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  expiresAt: string;
  current: boolean;
}

export const roleNames: Record<UserRole, string> = {
  CLIENT: "Клієнт",
  FREELANCER: "Фрилансер",
  ADMIN: "Адміністратор",
};

export type ProjectStatus =
  "PLANNING" | "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";
export type TaskStatus = "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";

export const projectStatusNames: Record<ProjectStatus, string> = {
  PLANNING: "Пошук виконавця",
  ACTIVE: "У процесі",
  PAUSED: "Призупинено",
  COMPLETED: "Завершено",
  CANCELLED: "Скасовано",
};
export const taskStatusNames: Record<TaskStatus, string> = {
  TODO: "До виконання",
  IN_PROGRESS: "У процесі",
  REVIEW: "На перевірці",
  DONE: "Завершено",
};

export interface Project {
  id: string;
  clientId: string;
  title: string;
  description: string | null;
  status: ProjectStatus;
  deadline: string | null;
  createdAt: string;
  updatedAt: string;
  totalTasks: number;
  completedTasks: number;
  progress: number;
  budgetMin?: number | null;
  budgetMax?: number | null;
  categoryId?: string | null;
  skills?: Skill[];
  category?: ProjectCategory | null;
}

export type ApplicationStatus = "PENDING" | "ACCEPTED" | "REJECTED";

export interface MarketplaceProject {
  id: string;
  clientId: string;
  title: string;
  description: string | null;
  status: ProjectStatus;
  deadline: string | null;
  createdAt: string;
  client: { id: string; name: string } | null;
  applicationStatus: ApplicationStatus | null;
  budgetMin: number | null;
  budgetMax: number | null;
  isFavorite: boolean;
  skills: Skill[];
  category: ProjectCategory | null;
}

export interface FreelancerReview {
  id: string;
  projectId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  project: { id: string; title: string } | null;
  client: { id: string; name: string } | null;
}

export interface FreelancerProfile extends User {
  status: "ACTIVE" | "BLOCKED";
  createdAt: string;
  completedProjects: number;
  averageCompletionDays: number | null;
  averageRating: number | null;
  reviewCount: number;
  reviews: FreelancerReview[];
  profile: {
    bio: string;
    hourlyRate: number | null;
    availability: "AVAILABLE" | "BUSY" | "UNAVAILABLE";
  };
  skills: Skill[];
  portfolio: PortfolioItem[];
  activeWorkload: number;
  onTimePercentage: number | null;
}

export interface ProjectApplication {
  id: string;
  projectId: string;
  freelancerId: string;
  message: string;
  proposedBudget: number;
  proposedDays: number;
  status: ApplicationStatus;
  createdAt: string;
  freelancer: FreelancerProfile;
  aiScore: number | null;
  aiReason: string | null;
}

export interface Skill {
  id: string;
  name: string;
}
export interface ProjectCategory {
  id: string;
  name: string;
}
export interface PortfolioItem {
  id: string;
  title: string;
  description: string | null;
  url: string;
}
export interface OwnFreelancerProfile {
  bio: string;
  hourlyRate: number | null;
  availability: "AVAILABLE" | "BUSY" | "UNAVAILABLE";
  skills: Skill[];
  portfolio: PortfolioItem[];
}
export interface Notification {
  id: string;
  type: string;
  message: string;
  projectId: string | null;
  taskId: string | null;
  readAt: string | null;
  createdAt: string;
}
export interface ProjectMilestone {
  id: string;
  title: string;
  description: string | null;
  position: number;
  deadline: string | null;
  amount: number;
  status: "PLANNED" | "IN_PROGRESS" | "REVIEW" | "COMPLETED";
  paymentStatus: "UNPAID" | "RESERVED" | "PAID";
}
export interface ActivityLog {
  id: string;
  type: string;
  message: string;
  createdAt: string;
  actor: { id: string; name: string } | null;
}
export interface Complaint {
  id: string;
  targetUserId: string | null;
  projectId: string | null;
  reason: string;
  description: string;
  status: "OPEN" | "RESOLVED" | "REJECTED";
  adminNote: string | null;
  createdAt: string;
}

export const applicationStatusNames: Record<ApplicationStatus, string> = {
  PENDING: "Очікує рішення",
  ACCEPTED: "Прийнято",
  REJECTED: "Відхилено",
};

export interface DashboardSummary {
  projects: number;
  activeProjects: number;
  tasks: number;
  completedTasks: number;
  overdueTasks: number;
  nearestDeadline: string | null;
  tasksByStatus: Record<TaskStatus, number>;
}

export interface ProjectMember {
  id: string;
  userId: string;
  user: User | null;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  assigneeId: string | null;
  status: TaskStatus;
  priority: "LOW" | "MEDIUM" | "HIGH";
  deadline: string | null;
  columnId?: string | null;
}

// Власна колонка канбану проєкту (етап усередині «У процесі»)
export interface BoardColumn {
  id: string;
  title: string;
  position: number;
  status: "TODO" | "IN_PROGRESS"; // етап, до якого належить колонка
}

export interface FileAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploadedBy?: string;
  uploadedAt?: string;
  submissionId?: string | null;
}

export interface WorkSubmission {
  id: string;
  taskId: string;
  description: string;
  submittedBy: string;
  status: "SUBMITTED" | "APPROVED" | "NEEDS_REVISION";
  submittedAt: string;
  reviewedAt: string | null;
  feedback: string | null;
  files: FileAttachment[];
}

export interface ProjectMessage {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
}

export type OrderStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export interface Order {
  id: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
}
export const orderStatusNames: Record<OrderStatus, string> = {
  PENDING: "Очікує початку",
  IN_PROGRESS: "У роботі",
  COMPLETED: "Виконано",
  CANCELLED: "Скасовано",
};
export const submissionStatusNames = {
  SUBMITTED: "Очікує перевірки",
  APPROVED: "Прийнято",
  NEEDS_REVISION: "Повернуто на доопрацювання",
};

export interface AdminUser extends User {
  status: "ACTIVE" | "BLOCKED";
  createdAt: string;
}

export interface AdminReport {
  users: number;
  blockedUsers: number;
  projects: number;
  activeProjects: number;
  completedProjects: number;
  tasks: number;
  overdueTasks: number;
  tasksByStatus: Record<TaskStatus, number>;
  usersByRole: Record<UserRole, number>;
  projectsByStatus: Record<ProjectStatus, number>;
  // month — «2026-10»
  growth: { month: string; users: number; projects: number }[];
}

export const priorityNames = {
  LOW: "Низький",
  MEDIUM: "Середній",
  HIGH: "Високий",
};

export interface TaskDeadline {
  id: string;
  projectId: string;
  title: string;
  deadline: string;
  status: TaskStatus;
  priority: "LOW" | "MEDIUM" | "HIGH";
  risk: "NONE" | "OVERDUE" | "NEAR_DEADLINE" | "HIGH_PRIORITY";
}

export interface FreelancerWorkload {
  user: { id: string; name: string } | null;
  activeTasks: number;
  overdueTasks: number;
  highPriorityTasks: number;
  nearestDeadline: string | null;
  tasks: {
    id: string;
    projectId: string;
    title: string;
    status: TaskStatus;
    priority: Task["priority"];
    deadline: string | null;
    risk: TaskDeadline["risk"];
  }[];
}
