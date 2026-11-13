import assert from "node:assert/strict";
import { test } from "node:test";
import { fieldMessage } from "../src/fieldErrors.ts";

const none = {
  valueMissing: false,
  tooShort: false,
  tooLong: false,
  rangeOverflow: false,
  rangeUnderflow: false,
  typeMismatch: false,
  badInput: false,
  stepMismatch: false,
};
const field = {
  type: "number",
  min: "1",
  max: "5000",
  minLength: 10,
  maxLength: 2000,
  valueLength: 3,
  fallback: "browser",
};

test("field errors explain what is wrong in the interface language", () => {
  assert.equal(
    fieldMessage({ ...none, valueMissing: true }, field, "uk"),
    "Заповніть це поле.",
  );
  assert.equal(
    fieldMessage({ ...none, rangeOverflow: true }, field, "uk"),
    "Не більше 5000.",
  );
  assert.equal(
    fieldMessage({ ...none, tooShort: true }, field, "en"),
    "At least 10 characters (now 3).",
  );
  assert.equal(
    fieldMessage(
      { ...none, typeMismatch: true },
      { ...field, type: "email" },
      "uk",
    ),
    "Введіть правильну адресу пошти, напр. name@example.com.",
  );
  assert.equal(fieldMessage(none, field, "uk"), "browser");
});
