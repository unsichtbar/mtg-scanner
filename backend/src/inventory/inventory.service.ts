import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/core';
import { ScryfallService } from '../scryfall/scryfall.service';
import { InventoryEntry } from '../entities/inventory-entry.entity';
import { User } from '../entities/user.entity';

export interface InventoryFilter {
  name?: string;
  colors?: string[];
  manaCost?: string;
  text?: string;
  type?: string;
  rarity?: string;
}

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryEntry)
    private readonly entries: EntityRepository<InventoryEntry>,
    @InjectRepository(User)
    private readonly users: EntityRepository<User>,
    private readonly em: EntityManager,
    private readonly scryfall: ScryfallService,
  ) {}

  async list(userId: string, filter: InventoryFilter) {
    const where: Record<string, any> = { user: userId };

    if (filter.name) where['card.name'] = { $ilike: `%${filter.name}%` };
    if (filter.colors?.length) where['card.colors'] = { $overlap: filter.colors };
    if (filter.manaCost) where['card.manaCost'] = { $like: `%${filter.manaCost}%` };
    if (filter.text) where['card.oracleText'] = { $ilike: `%${filter.text}%` };
    if (filter.type) where['card.typeLine'] = { $ilike: `%${filter.type}%` };
    if (filter.rarity) where['card.rarity'] = filter.rarity;

    return this.entries.findAll({
      where,
      populate: ['card'],
      orderBy: { card: { name: 'asc' } },
    });
  }

  async add(userId: string, cardId: string, quantity: number) {
    const card = await this.scryfall.findById(cardId);
    const user = await this.users.findOneOrFail(userId);

    const existing = await this.entries.findOne({ user, card });
    if (existing) {
      existing.quantity += quantity;
      await this.em.flush();
      return existing;
    }

    const entry = new InventoryEntry(user, card, quantity);
    this.em.persist(entry); await this.em.flush();
    return entry;
  }

  async update(userId: string, entryId: string, quantity: number) {
    const entry = await this.entries.findOne({ id: entryId, user: userId });
    if (!entry) throw new NotFoundException('Inventory entry not found');

    entry.quantity = quantity;
    await this.em.flush();
    return entry;
  }

  async remove(userId: string, entryId: string) {
    const entry = await this.entries.findOne({ id: entryId, user: userId });
    if (!entry) throw new NotFoundException('Inventory entry not found');

    this.em.remove(entry); await this.em.flush();
  }
}
