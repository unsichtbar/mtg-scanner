import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { User } from './entities/user.entity';
import { Card } from './entities/card.entity';
import { InventoryEntry } from './entities/inventory-entry.entity';
import { Deck } from './entities/deck.entity';
import { DeckCard } from './entities/deck-card.entity';
import { Container } from './entities/container.entity';
import { ContainerCard } from './entities/container-card.entity';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { ScryfallModule } from './scryfall/scryfall.module';
import { InventoryModule } from './inventory/inventory.module';
import { DecksModule } from './decks/decks.module';
import { ContainersModule } from './containers/containers.module';
import { ScanModule } from './scan/scan.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MikroOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        driver: PostgreSqlDriver,
        clientUrl: config.getOrThrow<string>('DATABASE_URL'),
        migrations: {
          path: 'dist/migrations',
          pathTs: 'src/migrations',
        },
        autoLoadEntities: true,
      }),
      inject: [ConfigService],
    }),
    MikroOrmModule.forFeature([User, Card, InventoryEntry, Deck, DeckCard, Container, ContainerCard]),
    DatabaseModule,
    AuthModule,
    ScryfallModule,
    InventoryModule,
    DecksModule,
    ContainersModule,
    ScanModule,
  ],
})
export class AppModule {}
