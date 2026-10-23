import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveTheme, readThemePreference } from "../src/theme.ts";

test("explicit theme wins and system mode follows the device", () => {
  assert.equal(resolveTheme("light", true), "light");
  assert.equal(resolveTheme("dark", false), "dark");
  assert.equal(resolveTheme("system", true), "dark");
  assert.equal(resolveTheme("system", false), "light");
});
test("missing or corrupted preferences fall back to system", () => {
  for (const value of [null, "", "broken", "SYSTEM"])
    assert.equal(readThemePreference(value), "system");
  for (const value of ["light", "dark", "system"])
    assert.equal(readThemePreference(value), value);
});
