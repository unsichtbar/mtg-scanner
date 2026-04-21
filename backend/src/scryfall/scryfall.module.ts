import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ScryfallService } from './scryfall.service';
import { Card } from '../entities/card.entity';

@Module({
  imports: [
    HttpModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        baseURL: config.getOrThrow<string>('SCRYFALL_BASE_URL'),
        headers: { 'User-Agent': 'MTGScanner/1.0' },
      }),
      inject: [ConfigService],
    }),
    MikroOrmModule.forFeature([Card]),
  ],
  providers: [ScryfallService],
  exports: [ScryfallService],
})
export class ScryfallModule {}
