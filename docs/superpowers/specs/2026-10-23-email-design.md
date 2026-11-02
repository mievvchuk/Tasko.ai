# Tasko.ai email design

Approved direction: templates live in the project and share the Tasko.ai style.
Render a white card on a pale background, brand name, Ukrainian heading and
explanation, violet action button, expiry, fallback URL and unsolicited-request note.
Support narrow screens with fluid tables and system fonts; no remote assets.
Verification and password reset use distinct text, routes and expiry periods.
Keep plain text alongside HTML and preserve token generation, SMTP and error handling.
Escape interpolated HTML content and attributes. Never include SMTP credentials.

Approaches: local templates (selected: versioned with code and existing SMTP);
Brevo-hosted templates (editable externally, adds provider coupling).
No new dependencies, provider changes or live emails during validation.
