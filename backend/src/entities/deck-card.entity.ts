import { Entity, PrimaryKey, Property, ManyToOne, Unique } from '@mikro-orm/core';
import { v4 as uuid } from 'uuid';
import { Deck } from './deck.entity';
import { Card } from './card.entity';

@Entity()
@Unique({ properties: ['deck', 'card'] })
export class DeckCard {
  @PrimaryKey()
  id: string = uuid();

  @ManyToOne(() => Deck)
  deck: Deck;

  @ManyToOne(() => Card)
  card: Card;

  @Property()
  quantity: number = 1;

  constructor(deck: Deck, card: Card, quantity = 1) {
    this.deck = deck;
    this.card = card;
    this.quantity = quantity;
  }
}
