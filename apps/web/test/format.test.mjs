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

test("password strength grows with length and character variety", async () => {
  const { passwordStrength } = await import("../src/format.ts");
  assert.equal(passwordStrength(""), 0);
  assert.equal(passwordStrength("Ab1!"), 1);
  assert.equal(passwordStrength("password"), 1);
  assert.equal(passwordStrength("Password1"), 2);
  assert.equal(passwordStrength("Password1!"), 3);
  assert.equal(passwordStrength("Пароль-Довгий-2026"), 4);
});

test("session address hides loopback and private networks", async () => {
  const { describeAddress } = await import("../src/format.ts");
  assert.equal(describeAddress("::1"), "Локальна мережа");
  assert.equal(describeAddress("::ffff:127.0.0.1"), "Локальна мережа");
  assert.equal(describeAddress("192.168.0.12"), "Локальна мережа");
  assert.equal(describeAddress("::ffff:93.170.12.4"), "93.170.12.4");
  assert.equal(describeAddress(null), "IP невідомий");
});

test("crop frame keeps the photo covering the circle", async () => {
  const { cropFrame } = await import("../src/format.ts");
  const wide = { width: 400, height: 200 };
  // Без зуму висота заповнює рамку, зсув по вертикалі неможливий
  const centred = cropFrame(wide, 100, 1, { x: -50, y: -30 });
  assert.equal(centred.scale, 0.5);
  assert.deepEqual([centred.x, centred.y], [-50, 0]);
  assert.deepEqual(centred.source, { x: 100, y: 0, size: 200 });
  // Зсув за край обмежується
  const dragged = cropFrame(wide, 100, 2, { x: 50, y: -500 });
  assert.deepEqual([dragged.x, dragged.y], [0, -100]);
  assert.deepEqual(dragged.source, { x: 0, y: 100, size: 100 });
});
