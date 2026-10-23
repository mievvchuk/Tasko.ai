import nodemailer from 'nodemailer';
import { MailService } from './mail.service.js';

vi.mock('nodemailer', () => ({ default: { createTransport: vi.fn() } }));
const config = {
  databaseUrl: 'postgresql://localhost/test',
  jwtSecret: 'x'.repeat(64),
  port: 3000,
  webOrigin: 'http://localhost:5173',
  smtpHost: 'smtp.gmail.com',
  smtpPort: 465,
  smtpUser: 'sender@gmail.com',
  smtpPassword: 'test-only-password',
  emailFrom: 'sender@gmail.com',
};

describe('SMTP mail transport', () => {
  it('uses TLS and puts only the verification token into the configured app link', async () => {
    const sendMail = vi.fn(
      async (_message: { text: string; html: string }) => ({
        accepted: ['user@example.com'],
      }),
    );
    const close = vi.fn();
    vi.mocked(nodemailer.createTransport).mockReturnValue({
      sendMail,
      close,
    } as unknown as ReturnType<typeof nodemailer.createTransport>);
    await new MailService(config).sendVerification(
      'user@example.com',
      'test-token',
    );
    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        requireTLS: true,
        debug: false,
      }),
    );
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        from: 'sender@gmail.com',
        text: expect.stringContaining(
          'http://localhost:5173/verify-email?token=test-token',
        ),
        html: expect.stringContaining('Підтвердити пошту'),
      }),
    );
    expect(sendMail.mock.calls[0][0].text).not.toContain(config.smtpPassword);
    expect(sendMail.mock.calls[0][0].html).toContain(
      'href="http://localhost:5173/verify-email?token=test-token"',
    );
    expect(sendMail.mock.calls[0][0].html).toContain('24 години');
    expect(sendMail.mock.calls[0][0].html).not.toContain(config.smtpPassword);
    expect(close).toHaveBeenCalled();
  });
  it('sends reset-specific HTML and text with the same safely escaped action URL', async () => {
    const sendMail = vi.fn(
      async (_message: { text: string; html: string }) => ({
        accepted: ['user@example.com'],
      }),
    );
    vi.mocked(nodemailer.createTransport).mockReturnValue({
      sendMail,
      close: vi.fn(),
    } as unknown as ReturnType<typeof nodemailer.createTransport>);
    await new MailService({
      ...config,
      webOrigin: 'https://tasko.example/?source=one&mode=two',
    }).sendReset('user@example.com', 'token+with&symbols');
    const { html, text } = sendMail.mock.calls[0][0];
    expect(html).toContain('Встановити новий пароль');
    expect(html).toContain('30 хвилин');
    expect(html).not.toContain('Підтвердити пошту');
    expect(text).toContain(
      'https://tasko.example/reset-password?token=token%2Bwith%26symbols',
    );
    expect(html).toContain(
      'href="https://tasko.example/reset-password?token=token%2Bwith%26symbols"',
    );
  });
  it('sanitizes SMTP errors and closes the transport', async () => {
    const close = vi.fn();
    const sendMail = vi.fn(async () => {
      throw new Error('private-provider-details');
    });
    vi.mocked(nodemailer.createTransport).mockReturnValue({
      sendMail,
      close,
    } as unknown as ReturnType<typeof nodemailer.createTransport>);
    await expect(
      new MailService(config).sendVerification('user@example.com', 'token'),
    ).rejects.toMatchObject({ status: 503 });
    await expect(
      new MailService(config).sendReset('user@example.com', 'token'),
    ).rejects.not.toThrow('private-provider-details');
    expect(close).toHaveBeenCalledTimes(2);
  });
});
