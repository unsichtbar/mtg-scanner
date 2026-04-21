import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScryfallService } from './scryfall.service';

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
  ],
  providers: [ScryfallService],
  exports: [ScryfallService],
})
export class ScryfallModule {}
