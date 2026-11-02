export type AuthEmailKind = 'reset';

const content = {
  reset: {
    subject: 'Відновлення пароля Tasko.ai',
    preheader: 'Встановіть новий пароль для свого облікового запису.',
    label: 'ВІДНОВЛЕННЯ ДОСТУПУ',
    title: 'Відновімо ваш доступ',
    description:
      'Ми отримали запит на відновлення пароля до вашого облікового запису Tasko.ai. Натисніть кнопку нижче, щоб встановити новий пароль.',
    button: 'Встановити новий пароль',
    action: 'Щоб встановити новий пароль Tasko.ai, відкрийте посилання',
    expiry: '30 хвилин',
    notice:
      'Якщо ви не надсилали цей запит, проігноруйте лист. Ваш пароль залишиться без змін.',
  },
} satisfies Record<AuthEmailKind, Record<string, string>>;

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character]!;
  });

/** Self-contained email markup: no external assets or email-client scripts. */
export function renderAuthEmail(kind: AuthEmailKind, link: URL) {
  const copy = content[kind];
  const url = escapeHtml(link.href);
  return {
    subject: copy.subject,
    text: `${copy.action}: ${link.href}\nПосилання діє ${copy.expiry}.\n${copy.notice}`,
    html: `<!doctype html>
<html lang="uk">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${copy.subject}</title>
  <style>
    @media only screen and (max-width: 600px) {
      .outer { padding: 24px 12px !important; }
      .content { padding: 28px 22px !important; }
      .title { font-size: 26px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f4f3fa;color:#202437;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${copy.preheader}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f4f3fa">
    <tr><td class="outer" align="center" style="padding:48px 16px;">
      <!--[if mso]><table role="presentation" width="560" align="center"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;">
        <tr><td align="center" style="padding:0 0 24px;font-size:26px;font-weight:700;letter-spacing:-1px;color:#5146dc;">Tasko<span style="color:#202437;">.ai</span></td></tr>
        <tr><td style="background-color:#ffffff;border:1px solid #e7e5f0;border-radius:16px;overflow:hidden;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr><td height="5" bgcolor="#5146dc" style="height:5px;font-size:0;line-height:0;">&nbsp;</td></tr>
            <tr><td class="content" style="padding:36px;">
              <p style="margin:0 0 16px;font-size:11px;line-height:18px;font-weight:700;letter-spacing:1.5px;color:#5146dc;">${copy.label}</p>
              <h1 class="title" style="margin:0 0 16px;font-size:30px;line-height:1.25;font-weight:700;color:#202437;">${copy.title}</h1>
              <p style="margin:0 0 28px;font-size:16px;line-height:26px;color:#596077;">${copy.description}</p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px;">
                <tr><td align="center" bgcolor="#5146dc" style="border-radius:8px;mso-padding-alt:16px 20px;">
                  <a href="${url}" style="display:inline-block;padding:16px 20px;border:1px solid #5146dc;border-radius:8px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;font-weight:700;color:#ffffff;text-decoration:none;">${copy.button}</a>
                </td></tr>
              </table>
              <p style="margin:0 0 28px;font-size:13px;line-height:21px;color:#596077;">Посилання діє <strong style="color:#202437;">${copy.expiry}</strong> і може бути використане лише один раз.</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="table-layout:fixed;">
                <tr><td style="padding:22px 0 0;border-top:1px solid #e7e5f0;">
                  <p style="margin:0 0 8px;font-size:12px;line-height:20px;color:#596077;">Якщо кнопка не працює, скопіюйте посилання та відкрийте його у браузері:</p>
                  <p style="margin:0;font-size:12px;line-height:20px;word-break:break-all;overflow-wrap:anywhere;"><a href="${url}" style="color:#5146dc;text-decoration:underline;word-break:break-all;">${url}</a></p>
                </td></tr>
              </table>
            </td></tr>
          </table>
        </td></tr>
        <tr><td align="center" style="padding:22px 16px 0;">
          <p style="margin:0 0 10px;font-size:12px;line-height:20px;color:#596077;">${copy.notice}</p>
          <p style="margin:0;font-size:12px;line-height:20px;color:#596077;">Tasko.ai · Простір для ваших проєктів</p>
        </td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td></tr>
  </table>
</body>
</html>`,
  };
}
