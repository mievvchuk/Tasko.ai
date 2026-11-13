import assert from "node:assert/strict";
import { test } from "node:test";
import { searchDocs } from "../src/search.mjs";

const docs = [
  { id: "board", title: "Канбан-дошка і завдання", description: "Колонки й статуси.", text: "Перетягніть картку в іншу колонку. Дедлайн видно на картці." },
  { id: "ai", title: "AI-помічниця Ада", description: "Що вміє Ада.", text: "Ада підкаже найближчий дедлайн і об'єм роботи." },
  { id: "en", title: "Kanban board", description: "Columns.", text: "Drag a card to another column." },
];

test("шукає в тексті без урахування регістру й для обох мов", () => {
  assert.deepEqual(searchDocs(docs, "КАРТКУ").map((d) => d.id), ["board"]);
  assert.deepEqual(searchDocs(docs, "drag CARD").map((d) => d.id), ["en"]);
});

test("усі слова мають збігатися, збіг у заголовку — вище", () => {
  assert.deepEqual(searchDocs(docs, "дедлайн ада").map((d) => d.id), ["ai"]);
  assert.deepEqual(searchDocs(docs, "дедлайн").map((d) => d.id), ["board", "ai"]);
  assert.deepEqual(searchDocs(docs, "канбан дедлайн").map((d) => d.id), ["board"]);
});

test("апострофи не заважають, порожній запит і відсутній збіг — порожньо", () => {
  assert.deepEqual(searchDocs(docs, "об’єм").map((d) => d.id), ["ai"]);
  assert.deepEqual(searchDocs(docs, "   "), []);
  assert.deepEqual(searchDocs(docs, "оплата"), []);
});

test("уривок показує місце збігу", () => {
  assert.match(searchDocs(docs, "колонку")[0].snippet, /колонку/);
  assert.equal(searchDocs(docs, "статуси")[0].snippet, "Колонки й статуси.");
});
