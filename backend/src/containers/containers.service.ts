import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { Container } from '../entities/container.entity';
import { ContainerCard } from '../entities/container-card.entity';
import { User } from '../entities/user.entity';
import { ScryfallService } from '../scryfall/scryfall.service';

@Injectable()
export class ContainersService {
  constructor(
    private readonly em: EntityManager,
    private readonly scryfall: ScryfallService,
  ) {}

  async list(userId: string) {
    return this.em.find(Container, { user: userId }, { orderBy: { createdAt: 'asc' } });
  }

  async get(userId: string, containerId: string) {
    const container = await this.em.findOne(
      Container,
      { id: containerId, user: userId },
      { populate: ['cards', 'cards.card'] },
    );
    if (!container) throw new NotFoundException('Container not found');
    return container;
  }

  async create(userId: string, name: string) {
    const user = await this.em.findOneOrFail(User, userId);
    const container = new Container(user, name);
    this.em.persist(container);
    await this.em.flush();
    return container;
  }

  async rename(userId: string, containerId: string, name: string) {
    const container = await this.ensureOwner(userId, containerId);
    container.name = name;
    await this.em.flush();
    return container;
  }

  async delete(userId: string, containerId: string) {
    const container = await this.ensureOwner(userId, containerId);
    await this.em.nativeDelete(ContainerCard, { container: container.id });
    this.em.remove(container);
    await this.em.flush();
  }

  async addCard(userId: string, containerId: string, cardId: string, quantity: number) {
    const container = await this.ensureOwner(userId, containerId);
    const card = await this.scryfall.findById(cardId);

    const existing = await this.em.findOne(ContainerCard, { container, card });
    if (existing) {
      existing.quantity += quantity;
      await this.em.flush();
      return existing;
    }

    const cc = new ContainerCard(container, card, quantity);
    this.em.persist(cc);
    await this.em.flush();
    return cc;
  }

  async setCardQuantity(userId: string, containerId: string, cardId: string, quantity: number) {
    const container = await this.ensureOwner(userId, containerId);
    const cc = await this.em.findOne(ContainerCard, { container, card: cardId }, { populate: ['card'] });
    if (!cc) throw new NotFoundException('Card not in container');

    if (quantity <= 0) {
      this.em.remove(cc);
      await this.em.flush();
      return null;
    }

    cc.quantity = quantity;
    await this.em.flush();
    return cc;
  }

  async removeCard(userId: string, containerId: string, cardId: string) {
    const container = await this.ensureOwner(userId, containerId);
    const cc = await this.em.findOne(ContainerCard, { container, card: cardId });
    if (!cc) throw new NotFoundException('Card not in container');
    this.em.remove(cc);
    await this.em.flush();
  }

  private async ensureOwner(userId: string, containerId: string) {
    const container = await this.em.findOne(Container, { id: containerId, user: userId });
    if (!container) throw new NotFoundException('Container not found');
    return container;
  }
}
