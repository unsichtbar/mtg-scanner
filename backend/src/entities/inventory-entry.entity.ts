import { Entity, PrimaryKey, Property, ManyToOne, Unique } from '@mikro-orm/core';
import { v4 as uuid } from 'uuid';
import { User } from './user.entity';
import { Card } from './card.entity';

@Entity()
@Unique({ properties: ['user', 'card'] })
export class InventoryEntry {
  @PrimaryKey()
  id: string = uuid();

  @ManyToOne(() => User)
  user: User;

  @ManyToOne(() => Card)
  card: Card;

  @Property()
  quantity: number = 1;

  @Property()
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  constructor(user: User, card: Card, quantity = 1) {
    this.user = user;
    this.card = card;
    this.quantity = quantity;
  }
}
