import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { APP_CONFIG } from '../config/config.module.js';
import type { AppConfig } from '../config/config.js';
import { createDb } from './db.js';

@Injectable()
export class PrismaService implements OnModuleDestroy {
  readonly client: ReturnType<typeof createDb>;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.client = createDb(config.databaseUrl);
  }

  async checkConnection() {
    await this.client.orm.public.User.select('id').limit(1).all();
  }

  async onModuleDestroy() {
    await this.client.close();
  }
}
