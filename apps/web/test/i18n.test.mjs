import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { enText, translate } from "../src/i18n.en.ts";
import * as types from "../src/types.ts";

// Усі тексти з tr("…") і trNow("…") у src, а також значення словників статусів з types.ts
export function translationKeys(
  dir = fileURLToPath(new URL("../src", import.meta.url)),
) {
  const keys = new Set();
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory())
      translationKeys(path).forEach((key) => keys.add(key));
    else if (/\.tsx?$/.test(entry.name))
      for (const match of readFileSync(path, "utf8").matchAll(
        /\btr(?:Now)?\(\s*("(?:[^"\\]|\\.)*")/g,
      ))
        keys.add(JSON.parse(match[1]));
  }
  return keys;
}

function allKeys() {
  const keys = translationKeys();
  for (const value of Object.values(types))
    if (value && typeof value === "object")
      Object.values(value).forEach((text) => keys.add(text));
  return keys;
}

test("every UI text has an English translation", () => {
  const missing = [...allKeys()].filter((key) => !(key in enText));
  assert.deepEqual(missing, []);
});

test("translations keep their {0} placeholders", () => {
  const slots = (text) => (text.match(/\{\d+\}/g) ?? []).sort();
  for (const [uk, en] of Object.entries(enText))
    assert.deepEqual(slots(en), slots(uk), uk);
});

test("translate falls back to Ukrainian and fills values", () => {
  assert.equal(
    translate("en", "Немає такого тексту {0}", [5]),
    "Немає такого тексту 5",
  );
  assert.equal(translate("uk", "Скасовано"), "Скасовано");
});

// Список ключів без перекладу: node test/i18n.test.mjs --missing
if (process.argv.includes("--missing"))
  console.log(
    JSON.stringify(
      [...allKeys()].filter((key) => !(key in enText)),
      null,
      1,
    ),
  );
