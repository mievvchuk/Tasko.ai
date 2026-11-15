import { defineConfig, devices } from "@playwright/test";

// Перед запуском: Docker із Postgres, `npm run db:migrate` і `npm run seed:demo` в apps/api.
export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  // Тести змінюють спільну БД, тож запускаємо по одному
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:5173",
    locale: "uk-UA",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // Із --headed сповільнюємо кожну дію, щоб було видно, що робить тест
    launchOptions: { slowMo: process.argv.includes("--headed") ? 600 : 0 },
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
  ],
  webServer: [
    {
      command: "npm --prefix ../api run start:dev",
      url: "http://localhost:3000/health",
      reuseExistingServer: true,
      timeout: 180_000,
    },
    {
      command: "npm run dev",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
});
