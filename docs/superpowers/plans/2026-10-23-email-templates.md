# Email templates implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Send branded Ukrainian HTML emails alongside the existing text messages.

**Architecture:** A pure template renderer in auth owns message copy and HTML.
MailService passes the existing URL to the renderer and sends its HTML and text.

**Tech Stack:** TypeScript, Nodemailer, Vitest; no new dependencies.

**Spec:** docs/superpowers/specs/2026-10-23-email-design.md

## Constraints and review focus

- Preserve SMTP settings, routes, token encoding, 24-hour and 30-minute expiry.
- Encode URLs safely for HTML attributes and retain the original text URL.
- No remote fonts, images, JavaScript or forms; fluid email table layout.
- No real recipient, secrets or delivery calls in tests and previews.
- Browser preview verifies narrow layout but cannot guarantee every mail client.

## Task 1: Templates and SMTP integration

- [x] Add failing transport tests for multipart output, reset copy and escaped URLs.
- [x] Add shared email renderer and use it for both SMTP mail types.
- [x] Run transport tests, API tests, typecheck, lint and formatting checks.
- [x] Render both templates at desktop and mobile widths and inspect a screenshot.

## Verification record

128 API unit tests passed. Typecheck, Oxlint, Nest build and changed-file
Prettier checks passed. Edge previews at 320, 390 and 900px showed no horizontal
overflow and two action/fallback links per email; mobile verification and desktop
reset screenshots were visually inspected. A fresh reviewer found no actionable
issues. No live emails sent and no app server started. Existing legacy non-SMTP
Resend fallback is outside this SMTP template change and retains its old markup.

Ruling: edited in place because this checkout has the entire application untracked;
a separate worktree would omit the existing project. No commit or dependency change.
