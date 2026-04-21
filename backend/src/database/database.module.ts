import { Module, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MikroORM } from '@mikro-orm/core';

@Module({})
export class DatabaseModule implements OnApplicationBootstrap {
  private readonly logger = new Logger(DatabaseModule.name);

  constructor(
    private readonly orm: MikroORM,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap() {
    if (this.config.get('DEV_MODE') === 'true') {
      this.logger.log('DEV_MODE: syncing database schema…');
      await this.orm.getSchemaGenerator().ensureDatabase();
      await this.orm.getSchemaGenerator().updateSchema();
      this.logger.log('Database schema up to date.');
    }
  }
}
