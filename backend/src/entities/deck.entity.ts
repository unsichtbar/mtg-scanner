import { Entity, PrimaryKey, Property, ManyToOne, OneToMany, Collection, Enum } from '@mikro-orm/core';
import { v4 as uuid } from 'uuid';
import { User } from './user.entity';
import { DeckCard } from './deck-card.entity';

export enum GameFormat {
  Standard = 'standard',
  Commander = 'commander',
}

@Entity()
export class Deck {
  @PrimaryKey()
  id: string = uuid();

  @ManyToOne(() => User)
  user: User;

  @Property()
  name: string;

  @Enum(() => GameFormat)
  format: GameFormat;

  @Property()
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  @OneToMany(() => DeckCard, (dc) => dc.deck, { cascade: ['all'] as any })
  cards = new Collection<DeckCard>(this);

  constructor(user: User, name: string, format: GameFormat) {
    this.user = user;
    this.name = name;
    this.format = format;
  }
}
