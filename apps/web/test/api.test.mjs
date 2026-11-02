import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { ApiError, request, sessionEndedEvent, tokenKey } from "../src/api.ts";
import { formatDate, parsePage, toDateTimeInput } from "../src/format.ts";

test("deadline input preserves local wall time and round-trips seconds", () => {
  assert.equal(toDateTimeInput(null), "");
  assert.equal(toDateTimeInput("invalid"), "");
  for (const value of ["2026-01-17T12:34:56Z", "2026-07-17T12:34:56Z"]) {
    const local = toDateTimeInput(value);
    assert.equal(new Date(local).getTime(), new Date(value).getTime());
    assert.equal(local.length, 19);
  }
});

test("pagination rejects invalid and oversized page numbers", () => {
  for (const value of [null, "", "wrong", "0", "-2", "1.5", "10001"]) {
    assert.equal(parsePage(value), 1);
  }
  assert.equal(parsePage("2"), 2);
  assert.equal(parsePage("10000"), 10000);
});

test("dates display Ukrainian text for missing and invalid values", () => {
  assert.equal(formatDate(null), "Не визначено");
  assert.equal(formatDate("invalid"), "Не визначено");
  assert.match(formatDate("2026-10-17T12:00:00Z"), /17\.10\.2026/);
});

const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
const originalStorage = globalThis.sessionStorage;
let storedToken;
let calls;

beforeEach(() => {
  storedToken = "test-only-token";
  calls = [];
  globalThis.sessionStorage = {
    getItem: (key) => (key === tokenKey ? storedToken : null),
  };
  globalThis.window = new EventTarget();
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return Response.json({ id: "test-result" });
  };
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  globalThis.window = originalWindow;
  globalThis.sessionStorage = originalStorage;
});

test("GET sends JWT and returns the server response", async () => {
  assert.deepEqual(await request("/auth/me"), { id: "test-result" });
  assert.equal(calls[0].url, "/api/auth/me");
  assert.equal(
    calls[0].options.headers.get("Authorization"),
    "Bearer test-only-token",
  );
  assert.equal(calls[0].options.body, undefined);
});

test("protected download returns binary content and sends JWT", async () => {
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(new Uint8Array([0, 1, 255]), {
      headers: { "Content-Type": "application/octet-stream" },
    });
  };
  const blob = await request("/files/test-id/download", {
    responseType: "blob",
  });
  assert.deepEqual([...new Uint8Array(await blob.arrayBuffer())], [0, 1, 255]);
  assert.equal(
    calls[0].options.headers.get("Authorization"),
    "Bearer test-only-token",
  );
});

test("binary download preserves authorization errors", async () => {
  globalThis.fetch = async () =>
    Response.json(
      { message: "Немає доступу до цього проєкту." },
      { status: 403 },
    );
  await assert.rejects(
    request("/files/test-id/download", { responseType: "blob" }),
    { status: 403, message: "Немає доступу до цього проєкту." },
  );
});

test("public POST sends JSON without a token", async () => {
  await request("/auth/login", {
    method: "POST",
    body: { email: "test@example.com" },
    auth: false,
  });
  assert.equal(calls[0].options.headers.get("Authorization"), null);
  assert.equal(
    calls[0].options.headers.get("Content-Type"),
    "application/json",
  );
  assert.equal(
    calls[0].options.body,
    JSON.stringify({ email: "test@example.com" }),
  );
});

test("supports PATCH, PUT and DELETE including an empty 204 response", async () => {
  for (const method of ["PATCH", "PUT", "DELETE"]) {
    globalThis.fetch = async (_url, options) => {
      assert.equal(options.method, method);
      return new Response(null, { status: 204 });
    };
    assert.equal(await request("/test-resource", { method }), undefined);
  }
});

test("FormData preserves browser multipart headers", async () => {
  const body = new FormData();
  body.set("file", new Blob(["test"]), "test.txt");
  await request("/test-upload", { method: "POST", body });
  assert.equal(calls[0].options.headers.has("Content-Type"), false);
  assert.equal(calls[0].options.body, body);
});

test("protected 401 ends the session", async () => {
  let ended = false;
  window.addEventListener(sessionEndedEvent, () => {
    ended = true;
  });
  globalThis.fetch = async () =>
    Response.json({ message: "Токен прострочений." }, { status: 401 });
  await assert.rejects(request("/auth/me"), {
    status: 401,
    message: "Токен прострочений.",
  });
  assert.equal(ended, true);
});

test("incorrect login does not end an existing session", async () => {
  let ended = false;
  window.addEventListener(sessionEndedEvent, () => {
    ended = true;
  });
  globalThis.fetch = async () =>
    Response.json(
      { message: "Неправильна пошта або пароль." },
      { status: 401 },
    );
  await assert.rejects(
    request("/auth/login", { method: "POST", auth: false }),
    { status: 401 },
  );
  assert.equal(ended, false);
});

test("ordinary forbidden access preserves the session; blocking ends it", async () => {
  let ended = 0;
  window.addEventListener(sessionEndedEvent, () => {
    ended++;
  });
  globalThis.fetch = async () =>
    Response.json({ message: "Немає доступу до проєкту." }, { status: 403 });
  await assert.rejects(request("/test-resource"), { status: 403 });
  assert.equal(ended, 0);
  globalThis.fetch = async () =>
    Response.json({ message: "Обліковий запис заблоковано." }, { status: 403 });
  await assert.rejects(request("/auth/me"), { status: 403 });
  assert.equal(ended, 1);
});

test("validation errors remain readable in Ukrainian", async () => {
  globalThis.fetch = async () =>
    Response.json({ message: ["email must be an email"] }, { status: 400 });
  await assert.rejects(request("/auth/register", { auth: false }), {
    status: 400,
    message: "Перевірте введені дані та спробуйте ще раз.",
  });
});

test("network failures and invalid JSON produce useful errors", async () => {
  globalThis.fetch = async () => {
    throw new TypeError("Failed to fetch");
  };
  await assert.rejects(
    request("/auth/me"),
    (error) => error instanceof ApiError && error.status === 0,
  );
  globalThis.fetch = async () =>
    new Response("<html>proxy error</html>", { status: 502 });
  await assert.rejects(request("/auth/me"), { status: 502 });
});

test("GET without a stored token does not send an empty Bearer header", async () => {
  storedToken = null;
  await request("/test-resource");
  assert.equal(calls[0].options.headers.has("Authorization"), false);
});
