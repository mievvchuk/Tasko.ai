import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { after, test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

// Node.js не читає JSX, тому лише в тесті перетворюємо TSX на звичайний JS.
const hooks = registerHooks({
  load(url, context, nextLoad) {
    if (!url.endsWith(".tsx")) return nextLoad(url, context);
    return {
      format: "module",
      shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          jsx: ts.JsxEmit.ReactJSX,
        },
      }).outputText,
    };
  },
});
after(() => hooks.deregister());
const { default: MarkdownAnswer } =
  await import("../src/components/MarkdownAnswer.tsx");
const render = (children) =>
  renderToStaticMarkup(createElement(MarkdownAnswer, { children }));

test("agent table renders headers, bold text and a scrollable region", () => {
  const html = render(
    "| Поле | Значення |\n| --- | --- |\n| **Назва** | Тестовий проєкт |",
  );
  assert.match(html, /role="region"/);
  assert.match(html, /tabindex="0"/);
  assert.match(html, /<th>Поле<\/th>/);
  assert.match(html, /<td><strong>Назва<\/strong><\/td>/);
  assert.match(html, /<td>Тестовий проєкт<\/td>/);
});

test("headings, lists, quotes and code render as structured content", () => {
  const html = render(
    "## Пріоритети\n\n1. **Важливо**\n2. *Пізніше*\n\n- Завдання\n\n> Порада\n\n`status`\n\n```js\nconst done = true;\n```",
  );
  for (const tag of [
    "h2",
    "ol",
    "ul",
    "strong",
    "em",
    "blockquote",
    "pre",
    "code",
  ]) {
    assert.match(html, new RegExp(`<${tag}[ >]`));
  }
});

test("safe links open separately and javascript URLs are rejected", () => {
  const html = render(
    "[Довідка](https://example.com/help) [Небезпечно](javascript:alert%281%29)",
  );
  assert.match(html, /href="https:\/\/example.com\/help"/);
  assert.match(html, /target="_blank"/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.doesNotMatch(html, /href="javascript:/i);
});

test("raw HTML and remote images are not rendered", () => {
  const html = render(
    '<script>alert(1)</script>\n\n<img src="https://example.com/pixel" onerror="alert(1)">\n\n![Зображення](https://example.com/pixel.png)\n\nЗвичайний текст.',
  );
  assert.doesNotMatch(html, /<script|<img|onerror=/i);
  assert.match(html, /Звичайний текст\./);
});

test("project links remain in the current tab", () => {
  const html = render("[Проєкт](/projects/test-project)");
  assert.match(html, /href="\/projects\/test-project"/);
  assert.doesNotMatch(html, /target="_blank"/);
});

test("plain text and an empty answer remain readable", () => {
  assert.match(render("Немає активних проєктів."), /Немає активних проєктів\./);
  assert.equal(render(""), '<div class="ai-answer"></div>');
});
