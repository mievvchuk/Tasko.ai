import {
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { APP_CONFIG } from '../config/config.module.js';
import type { AppConfig } from '../config/config.js';

export interface GoogleProfile {
  googleId: string;
  email: string;
  name?: string;
}

// Перевіряє ID-токен від кнопки «Увійти через Google»: підпис Google,
// термін дії та що токен виданий саме для нашого Client ID.
@Injectable()
export class GoogleVerifier {
  private readonly client = new OAuth2Client();

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  async verify(idToken: string): Promise<GoogleProfile> {
    const audience = this.config.googleClientId;
    if (!audience)
      throw new ServiceUnavailableException(
        'Вхід через Google не налаштовано.',
      );
    let payload;
    try {
      const ticket = await this.client.verifyIdToken({ idToken, audience });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException(
        'Не вдалося підтвердити вхід через Google. Спробуйте ще раз.',
      );
    }
    // Непідтвердженій пошті не довіряємо: інакше можна було б увійти в чужий акаунт
    if (!payload?.sub || !payload.email || !payload.email_verified)
      throw new UnauthorizedException(
        'Google не підтвердив пошту цього акаунта.',
      );
    return {
      googleId: payload.sub,
      email: payload.email.toLowerCase(),
      name: payload.name,
    };
  }
}
