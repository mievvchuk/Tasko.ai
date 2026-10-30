import { config } from 'dotenv';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface AppConfig {
  databaseUrl: string;
  jwtSecret: string;
  port: number;
  webOrigin: string;
  aiApiKey?: string;
  aiBaseUrl?: string;
  aiModel?: string;
  emailApiKey?: string;
  emailFrom?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassword?: string;
}

export function loadEnvironment() {
  config({
    path: [
      resolve(process.cwd(), '.env'),
      fileURLToPath(new URL('../../../../.env', import.meta.url)),
    ],
    quiet: true,
  });
}

export function readConfig(env: NodeJS.ProcessEnv): AppConfig {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl || !URL.canParse(databaseUrl)) {
    throw new Error('DATABASE_URL має містити адресу PostgreSQL.');
  }
  if (!['postgres:', 'postgresql:'].includes(new URL(databaseUrl).protocol)) {
    throw new Error('DATABASE_URL має використовувати PostgreSQL.');
  }
  const jwtSecret = env.JWT_SECRET;
  if (
    !jwtSecret ||
    jwtSecret.length < 32 ||
    jwtSecret.includes('your_super_secret')
  ) {
    throw new Error(
      'JWT_SECRET має містити щонайменше 32 символи та не бути шаблоном.',
    );
  }
  const port = Number(env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT має бути цілим числом від 1 до 65535.');
  }
  const smtpHost = env.SMTP_HOST?.trim();
  const smtpPort = Number(env.SMTP_PORT || 465);
  if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535)
    throw new Error('SMTP_PORT має бути коректним номером порту.');
  if (smtpHost && (!env.SMTP_USER || !env.SMTP_PASSWORD))
    throw new Error('Заповніть SMTP_USER та SMTP_PASSWORD.');
  const webOrigin = env.WEB_ORIGIN ?? 'http://localhost:5173';
  if (
    !URL.canParse(webOrigin) ||
    !['https:', 'http:'].includes(new URL(webOrigin).protocol)
  )
    throw new Error(
      'WEB_ORIGIN має бути адресою вебзастосунку HTTP або HTTPS.',
    );
  return {
    databaseUrl,
    jwtSecret,
    port,
    webOrigin,
    aiApiKey: env.AI_API_KEY || env.OPENAI_API_KEY,
    aiBaseUrl: env.AI_BASE_URL || 'https://api.openai.com/v1',
    aiModel: env.OPENAI_MODEL,
    emailApiKey: env.EMAIL_API_KEY,
    emailFrom: env.EMAIL_FROM || env.SMTP_USER,
    smtpHost,
    smtpPort,
    smtpUser: env.SMTP_USER,
    smtpPassword: env.SMTP_PASSWORD,
  };
}

export function loadConfig(): AppConfig {
  loadEnvironment();
  return readConfig(process.env);
}
