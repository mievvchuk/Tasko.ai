import {
  Link,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router";
import { useAuth } from "./auth";
import { AuthLayout } from "./components/AuthLayout";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { WorkspacePage } from "./pages/WorkspacePage";
import { DashboardPage } from "./pages/DashboardPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { ProjectFormPage } from "./pages/ProjectFormPage";
import { ProjectDetailsPage } from "./pages/ProjectDetailsPage";
import { TasksPage } from "./pages/TasksPage";
import { TaskFormPage } from "./pages/TaskFormPage";
import { TaskDetailsPage } from "./pages/TaskDetailsPage";
import { MessagesPage } from "./pages/MessagesPage";
import { OrdersPage } from "./pages/OrdersPage";
import { FilesPage } from "./pages/FilesPage";
import { AiAssistantPage } from "./pages/AiAssistantPage";
import { AdminPage } from "./pages/AdminPage";
import { MarketplacePage } from "./pages/MarketplacePage";
import { ProjectApplicationsPage } from "./pages/ProjectApplicationsPage";
import { FreelancerProfilePage } from "./pages/FreelancerProfilePage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { WelcomePage } from "./pages/WelcomePage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { WorkloadPage } from "./pages/WorkloadPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { ProjectBoardPage } from "./pages/ProjectBoardPage";
import { ProjectMilestonesPage } from "./pages/ProjectMilestonesPage";
import { ProjectActivityPage } from "./pages/ProjectActivityPage";
import { ComplaintsPage } from "./pages/ComplaintsPage";
import { ProjectPlanPage } from "./pages/ProjectPlanPage";

import { useLanguage } from "./i18n";
function ProtectedRoute() {
  const { user } = useAuth();
  // Гість, що відкрив головну, бачить вітальну сторінку; інші адреси ведуть на вхід
  const { pathname } = useLocation();
  if (!user)
    return <Navigate to={pathname === "/" ? "/welcome" : "/login"} replace />;
  return <Outlet />;
}

function GuestRoute() {
  const { user } = useAuth();
  if (user) return <Navigate to="/" replace />;
  return <Outlet />;
}

export function App() {
  const { tr } = useLanguage();
  const { loading, connectionError, retry, logout } = useAuth();
  if (loading)
    return (
      <div className="connection-screen" role="status">
        <span className="loader" />

        {tr("Перевіряємо ваш сеанс…")}
      </div>
    );
  if (connectionError)
    return (
      <main className="connection-screen">
        <section className="auth-card">
          <span className="card-kicker">TASKO.AI</span>
          <h1>{tr("Не вдалося відновити сеанс")}</h1>
          <p role="alert">{connectionError}</p>
          <div className="connection-actions">
            <button className="button primary" onClick={retry}>
              {tr("Спробувати ще раз")}
            </button>
            <button className="button secondary" onClick={logout}>
              {tr("Повернутися до входу")}
            </button>
          </div>
        </section>
      </main>
    );

  return (
    <Routes>
      <Route element={<GuestRoute />}>
        <Route path="/welcome" element={<WelcomePage />} />
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Route>
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/new" element={<ProjectFormPage />} />
          <Route path="projects/:id" element={<ProjectDetailsPage />} />
          <Route path="projects/:id/board" element={<ProjectBoardPage />} />
          <Route path="projects/:id/plan" element={<ProjectPlanPage />} />
          <Route
            path="projects/:id/milestones"
            element={<ProjectMilestonesPage />}
          />
          <Route
            path="projects/:id/activity"
            element={<ProjectActivityPage />}
          />
          <Route path="projects/:id/edit" element={<ProjectFormPage />} />
          <Route path="projects/:id/tasks/new" element={<TaskFormPage />} />
          <Route path="projects/:id/orders" element={<OrdersPage />} />
          <Route path="projects/:id/files" element={<FilesPage />} />
          <Route
            path="projects/:id/applications"
            element={<ProjectApplicationsPage />}
          />
          <Route path="marketplace" element={<MarketplacePage />} />
          <Route path="freelancers/:id" element={<FreelancerProfilePage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="workload" element={<WorkloadPage />} />
          <Route path="tasks/:taskId" element={<TaskDetailsPage />} />
          <Route path="tasks/:taskId/edit" element={<TaskFormPage />} />
          <Route path="messages" element={<MessagesPage />} />
          <Route path="ai" element={<AiAssistantPage />} />
          <Route path="admin" element={<AdminPage />} />
          <Route path="profile" element={<WorkspacePage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="complaints" element={<ComplaintsPage />} />
          <Route
            path="*"
            element={
              <section className="account-panel not-found">
                <i
                  className="bi bi-exclamation-triangle"
                  aria-hidden="true"
                ></i>
                <h1>{tr("Сторінку не знайдено")}</h1>
                <p>
                  {tr("Перевірте адресу або поверніться до робочого простору.")}
                </p>
                <Link className="button primary" to="/">
                  {tr("На головну")}
                </Link>
              </section>
            }
          />
        </Route>
      </Route>
    </Routes>
  );
}
