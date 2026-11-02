import assert from "node:assert/strict";
import { test } from "node:test";
import { describeDevice } from "../src/format.ts";

test("session device is shown as browser and operating system", () => {
  assert.equal(
    describeDevice(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36",
    ),
    "Chrome на Windows",
  );
  assert.equal(
    describeDevice(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
    ),
    "Safari на macOS",
  );
  assert.equal(
    describeDevice(
      "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/152.0 Safari/537.36 Edg/152.0",
    ),
    "Edge на Windows",
  );
});
test("unknown or missing user agents get a neutral label", () => {
  assert.equal(describeDevice(null), "Невідомий браузер");
  assert.equal(describeDevice("curl/8.0"), "Невідомий браузер");
});

test("deadline label counts calendar days, not hours", async () => {
  const { daysLeft, deadlineLabel } = await import("../src/format.ts");
  const now = new Date(2026, 9, 30, 23, 30);
  assert.equal(daysLeft(new Date(2026, 9, 31, 0, 10).toISOString(), now), 1);
  assert.equal(
    deadlineLabel(new Date(2026, 9, 30, 8).toISOString(), now),
    "Сьогодні",
  );
  assert.equal(
    deadlineLabel(new Date(2026, 10, 2).toISOString(), now),
    "Через 3 дн.",
  );
  assert.equal(
    deadlineLabel(new Date(2026, 9, 28).toISOString(), now),
    "Прострочено на 2 дн.",
  );
});
