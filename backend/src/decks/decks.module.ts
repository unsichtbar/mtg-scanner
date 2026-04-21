import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { DecksService } from './decks.service';
import { DecksController } from './decks.controller';
import { ScryfallModule } from '../scryfall/scryfall.module';
import { Deck } from '../entities/deck.entity';
import { DeckCard } from '../entities/deck-card.entity';
import { User } from '../entities/user.entity';

@Module({
  imports: [ScryfallModule, MikroOrmModule.forFeature([Deck, DeckCard, User])],
  providers: [DecksService],
  controllers: [DecksController],
})
export class DecksModule {}
