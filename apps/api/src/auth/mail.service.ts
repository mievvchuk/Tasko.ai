import {
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import nodemailer from 'nodemailer';
import { APP_CONFIG } from '../config/config.module.js';
import type { AppConfig } from '../config/config.js';
import { renderAuthEmail, type AuthEmailKind } from './mail-template.js';

@Injectable()
export class MailService {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  configured() {
    return Boolean(
      this.config.smtpHost &&
      this.config.smtpUser &&
      this.config.smtpPassword &&
      this.config.emailFrom,
    );
  }

  private async send(
    email: string,
    kind: AuthEmailKind,
    route: string,
    token: string,
  ) {
    if (!this.configured())
      throw new ServiceUnavailableException(
        'Надсилання листів SMTP ще не налаштовано.',
      );
    const link = new URL(route, this.config.webOrigin);
    link.searchParams.set('token', token);
    const transport = nodemailer.createTransport({
      host: this.config.smtpHost,
      port: this.config.smtpPort || 465,
      secure: (this.config.smtpPort || 465) === 465,
      requireTLS: true,
      auth: { user: this.config.smtpUser!, pass: this.config.smtpPassword! },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      disableFileAccess: true,
      disableUrlAccess: true,
      logger: false,
      debug: false,
    });
    try {
      const sent = await transport.sendMail({
        from: this.config.emailFrom,
        to: email,
        ...renderAuthEmail(kind, link),
      });
      if (!sent.accepted?.length) throw new Error('No recipients accepted');
    } catch {
      // Never expose provider errors: they can contain recipients or credentials.
      throw new ServiceUnavailableException(
        'Не вдалося надіслати лист. Спробуйте пізніше.',
      );
    } finally {
      transport.close();
    }
  }

  sendVerification(email: string, token: string) {
    return this.send(email, 'verification', '/verify-email', token);
  }
  sendReset(email: string, token: string) {
    return this.send(email, 'reset', '/reset-password', token);
  }
}
