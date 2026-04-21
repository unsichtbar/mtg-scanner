import { Module, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MikroORM, EntityManager } from '@mikro-orm/core';
import { User } from '../entities/user.entity';

export const DEV_USER_EMAIL = 'dev@local';

@Module({})
export class DatabaseModule implements OnApplicationBootstrap {
  private readonly logger = new Logger(DatabaseModule.name);

  constructor(
    private readonly orm: MikroORM,
    private readonly em: EntityManager,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap() {
    if (this.config.get('DEV_MODE') === 'true') {
      this.logger.log('DEV_MODE: syncing database schema…');
      await this.orm.getSchemaGenerator().ensureDatabase();
      await this.orm.getSchemaGenerator().updateSchema();
      this.logger.log('Database schema up to date.');

      // Ensure a dev user exists and expose its ID for the JWT guard bypass
      const em = this.em.fork();
      let devUser = await em.findOne(User, { email: DEV_USER_EMAIL });
      if (!devUser) {
        devUser = new User(DEV_USER_EMAIL, 'dev-no-password');
        em.persist(devUser);
        await em.flush();
        this.logger.log(`DEV_MODE: created dev user (id=${devUser.id})`);
      }
      process.env.DEV_USER_ID = devUser.id;
    }
  }
}
