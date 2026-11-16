import { authFile, apiGet, expect, expectPageOpens, test, type Role } from "./support";

type Project = { id: string; clientId: string; totalTasks: number };
type Task = { id: string };

// Кожна роль відкриває всі свої сторінки: має бути заголовок, без 404, заборони, помилок і JS-винятків
const pages: Record<Role, (ids: Record<string, string>) => string[]> = {
  client: (ids) => [
    "/",
    "/projects",
    "/projects/new",
    `/projects/${ids.project}`,
    `/projects/${ids.project}/board`,
    `/projects/${ids.project}/plan`,
    `/projects/${ids.project}/milestones`,
    `/projects/${ids.project}/activity`,
    `/projects/${ids.project}/files`,
    `/projects/${ids.project}/applications`,
    `/projects/${ids.project}/edit`,
    `/projects/${ids.project}/tasks/new`,
    "/tasks",
    `/tasks/${ids.task}`,
    `/tasks/${ids.task}/edit`,
    "/workload",
    "/messages",
    "/ai",
    "/profile",
    "/notifications",
    "/complaints",
    "/help",
    `/freelancers/${ids.freelancer}`,
  ],
  freelancer: (ids) => [
    "/",
    "/projects",
    `/projects/${ids.project}`,
    `/projects/${ids.project}/board`,
    `/projects/${ids.project}/milestones`,
    `/projects/${ids.project}/files`,
    "/marketplace",
    `/marketplace/${ids.market}`,
    "/tasks",
    `/tasks/${ids.task}`,
    "/workload",
    "/messages",
    "/ai",
    "/profile",
    "/notifications",
    "/complaints",
    "/help",
    `/clients/${ids.client}`,
  ],
  admin: () => ["/admin", "/admin/users", "/admin/moderation", "/admin/projects", "/admin/complaints", "/admin/ai"],
};

for (const role of Object.keys(pages) as Role[]) {
  test.describe(`сторінки: ${role}`, () => {
    test.use({ storageState: authFile(role) });
    const ids: Record<string, string> = {};

    test.beforeAll(async ({ browser }) => {
      if (role === "admin") return;
      const page = await browser.newPage();
      const projects = await apiGet<Project[]>(page, role, "/projects");
      const tasks = await apiGet<Task[]>(page, role, "/tasks");
      const project = projects.find((item) => item.totalTasks > 0) ?? projects[0];
      ids.project = project.id;
      ids.task = tasks[0].id;
      ids.client = project.clientId;
      ids.freelancer = "d3e00000-0000-4000-8000-000000000003";
      if (role === "freelancer") {
        ids.market = (await apiGet<Project[]>(page, role, "/marketplace/projects"))[0].id;
      }
      await page.close();
    });

    // Шляхи з :id відомі лише після beforeAll, тому підставляємо їх усередині тесту
    for (const [index, template] of pages[role]({
      project: ":project",
      task: ":task",
      market: ":market",
      client: ":client",
      freelancer: ":freelancer",
    }).entries()) {
      test(`відкривається ${template}`, async ({ page }) => {
        const path = pages[role](ids)[index];
        await expectPageOpens(page, path);
      });
    }
  });
}

test.describe("доступ до адмін-панелі", () => {
  for (const role of ["client", "freelancer"] as const) {
    test(`${role} не бачить адмін-панель`, async ({ browser }) => {
      const context = await browser.newContext({ storageState: authFile(role) });
      const page = await context.newPage();
      await page.goto("/admin/users");
      await expect(page.getByRole("heading", { name: "Доступ заборонено" })).toBeVisible();
      await context.close();
    });
  }

  test("гість потрапляє на сторінку входу", async ({ page }) => {
    await page.goto("/projects");
    await expect(page).toHaveURL(/\/(login|welcome)/);
  });
});
