import { Entity, PrimaryKey, Property, OneToMany, Collection } from '@mikro-orm/core';
import { v4 as uuid } from 'uuid';
import { InventoryEntry } from './inventory-entry.entity';
import { Deck } from './deck.entity';

@Entity()
export class User {
  @PrimaryKey()
  id: string = uuid();

  @Property({ unique: true })
  email: string;

  @Property({ hidden: true })
  passwordHash: string;

  @Property()
  createdAt: Date = new Date();

  @OneToMany(() => InventoryEntry, (entry) => entry.user)
  inventory = new Collection<InventoryEntry>(this);

  @OneToMany(() => Deck, (deck) => deck.user)
  decks = new Collection<Deck>(this);

  constructor(email: string, passwordHash: string) {
    this.email = email;
    this.passwordHash = passwordHash;
  }
}
