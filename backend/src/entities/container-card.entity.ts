import { Entity, PrimaryKey, Property, ManyToOne, Unique } from '@mikro-orm/core';
import { v4 as uuid } from 'uuid';
import { Container } from './container.entity';
import { Card } from './card.entity';

@Entity()
@Unique({ properties: ['container', 'card'] })
export class ContainerCard {
  @PrimaryKey()
  id: string = uuid();

  @ManyToOne(() => Container)
  container: Container;

  @ManyToOne(() => Card)
  card: Card;

  @Property()
  quantity: number = 1;

  constructor(container: Container, card: Card, quantity = 1) {
    this.container = container;
    this.card = card;
    this.quantity = quantity;
  }
}
