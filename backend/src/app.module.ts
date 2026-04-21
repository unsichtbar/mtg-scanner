import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { AuthModule } from './auth/auth.module';
import { ScryfallModule } from './scryfall/scryfall.module';
import { InventoryModule } from './inventory/inventory.module';
import { DecksModule } from './decks/decks.module';
import { ScanModule } from './scan/scan.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MikroOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        driver: PostgreSqlDriver,
        clientUrl: config.getOrThrow<string>('DATABASE_URL'),
        entities: ['dist/**/*.entity.js'],
        entitiesTs: ['src/**/*.entity.ts'],
        migrations: {
          path: 'dist/migrations',
          pathTs: 'src/migrations',
        },
        autoLoadEntities: true,
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    ScryfallModule,
    InventoryModule,
    DecksModule,
    ScanModule,
  ],
})
export class AppModule {}
