import { Entity, PrimaryKey, Property, ManyToOne, OneToMany, Collection } from '@mikro-orm/core';
import { v4 as uuid } from 'uuid';
import { User } from './user.entity';
import { ContainerCard } from './container-card.entity';

@Entity()
export class Container {
  @PrimaryKey()
  id: string = uuid();

  @ManyToOne(() => User)
  user: User;

  @Property()
  name: string;

  @Property({ onCreate: () => new Date() })
  createdAt: Date = new Date();

  @OneToMany(() => ContainerCard, (cc) => cc.container, { cascade: ['all'] as any })
  cards = new Collection<ContainerCard>(this);

  constructor(user: User, name: string) {
    this.user = user;
    this.name = name;
  }
}
