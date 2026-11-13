import assert from "node:assert/strict";
import { test } from "node:test";
import { recommendAction } from "../src/complaintRules.ts";

test("sanctions grow with repeated confirmed complaints", () => {
  assert.equal(recommendAction("FRAUD", { confirmed: 0 }).action, "BLOCK");
  assert.deepEqual(
    [0, 1, 5].map(
      (confirmed) => recommendAction("NON_PAYMENT", { confirmed }).action,
    ),
    ["RESTRICT", "BLOCK", "BLOCK"],
  );
  assert.equal(recommendAction("NON_PAYMENT", { confirmed: 0 }).days, 14);
  assert.deepEqual(
    [0, 1, 2, 3].map(
      (confirmed) => recommendAction("NOT_DELIVERED", { confirmed }).action,
    ),
    ["WARNING", "RESTRICT", "RESTRICT", "BLOCK"],
  );
  assert.equal(
    recommendAction("POOR_QUALITY", { confirmed: 0 }).action,
    "NONE",
  );
});
