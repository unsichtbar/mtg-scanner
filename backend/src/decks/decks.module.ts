import { Module } from '@nestjs/common';
import { DecksService } from './decks.service';
import { DecksController } from './decks.controller';
import { ScryfallModule } from '../scryfall/scryfall.module';

@Module({
  imports: [ScryfallModule],
  providers: [DecksService],
  controllers: [DecksController],
})
export class DecksModule {}
