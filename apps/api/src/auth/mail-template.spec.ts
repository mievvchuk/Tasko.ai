import { renderAuthEmail } from './mail-template.js';

describe('auth email URL safety', () => {
  it('escapes a URL consistently in buttons and fallback links without changing the text URL', () => {
    const url = new URL(
      'https://tasko.example/reset-password?token=demo&label="test"',
    );
    const { html, text } = renderAuthEmail('reset', url);
    expect(html).not.toContain('&label=');
    expect(html).toContain('&amp;label=');
    expect(text).toContain(url.href);
    expect(html.match(/href="https:\/\/tasko.example/g)).toHaveLength(2);
  });
});
