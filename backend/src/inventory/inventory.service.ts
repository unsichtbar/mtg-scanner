import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { ScryfallService } from '../scryfall/scryfall.service';
import { InventoryEntry } from '../entities/inventory-entry.entity';
import { User } from '../entities/user.entity';
import { DeckCard } from '../entities/deck-card.entity';
import { Deck } from '../entities/deck.entity';
import { ContainerCard } from '../entities/container-card.entity';
import { Container } from '../entities/container.entity';

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
    private readonly em: EntityManager,
    private readonly scryfall: ScryfallService,
  ) {}

  async list(userId: string, filter: InventoryFilter): Promise<any[]> {
    const cardWhere: Record<string, any> = {};
    if (filter.name) cardWhere.name = { $ilike: `%${filter.name}%` };
    if (filter.colors?.length) cardWhere.colors = { $overlap: filter.colors };
    if (filter.manaCost) cardWhere.manaCost = { $like: `%${filter.manaCost}%` };
    if (filter.text) cardWhere.oracleText = { $ilike: `%${filter.text}%` };
    if (filter.type) cardWhere.typeLine = { $ilike: `%${filter.type}%` };
    if (filter.rarity) cardWhere.rarity = filter.rarity;

    const entries = await this.em.find(InventoryEntry, {
      user: userId,
      ...(Object.keys(cardWhere).length ? { card: cardWhere } : {}),
    }, {
      populate: ['card'],
      orderBy: { card: { name: 'asc' } },
    });

    // Attach deck membership
    const userDecks = await this.em.find(Deck, { user: userId });
    const deckCards = await this.em.find(DeckCard, {
      deck: { $in: userDecks.map((d) => d.id) },
    }, { populate: ['deck'] });

    const cardDeckMap = new Map<string, { id: string; name: string; quantity: number }[]>();
    for (const dc of deckCards) {
      const cardId = (dc.card as any).id ?? dc.card;
      if (!cardDeckMap.has(cardId)) cardDeckMap.set(cardId, []);
      cardDeckMap.get(cardId)!.push({ id: dc.deck.id, name: dc.deck.name, quantity: dc.quantity });
    }

    // Attach container membership
    const userContainers = await this.em.find(Container, { user: userId });
    const containerCards = await this.em.find(ContainerCard, {
      container: { $in: userContainers.map((c) => c.id) },
    }, { populate: ['container'] });

    const cardContainerMap = new Map<string, { id: string; name: string; quantity: number }[]>();
    for (const cc of containerCards) {
      const cardId = (cc.card as any).id ?? cc.card;
      if (!cardContainerMap.has(cardId)) cardContainerMap.set(cardId, []);
      cardContainerMap.get(cardId)!.push({ id: cc.container.id, name: cc.container.name, quantity: cc.quantity });
    }

    return entries.map((entry) => ({
      ...entry,
      inDecks: cardDeckMap.get(entry.card.id) ?? [],
      inContainers: cardContainerMap.get(entry.card.id) ?? [],
    }));
  }

  async add(userId: string, cardId: string, quantity: number) {
    const card = await this.scryfall.findById(cardId);
    const user = await this.em.findOneOrFail(User, userId);

    const existing = await this.em.findOne(InventoryEntry, { user, card });
    if (existing) {
      existing.quantity += quantity;
      await this.em.flush();
      return existing;
    }

    const entry = new InventoryEntry(user, card, quantity);
    this.em.persist(entry);
    await this.em.flush();
    return entry;
  }

  async update(userId: string, entryId: string, quantity: number) {
    const entry = await this.em.findOne(InventoryEntry, { id: entryId, user: userId });
    if (!entry) throw new NotFoundException('Inventory entry not found');

    entry.quantity = quantity;
    await this.em.flush();
    return entry;
  }

  async remove(userId: string, entryId: string) {
    const entry = await this.em.findOne(InventoryEntry, { id: entryId, user: userId });
    if (!entry) throw new NotFoundException('Inventory entry not found');

    this.em.remove(entry);
    await this.em.flush();
  }

  async exportCsv(userId: string): Promise<string> {
    const entries = await this.em.find(InventoryEntry, { user: userId }, {
      populate: ['card'],
      orderBy: { card: { name: 'asc' } },
    });
    return entries.map((e) => `${e.card.name},${e.quantity}`).join('\n');
  }

  async exportVersionedCsv(userId: string): Promise<string> {
    const entries = await this.em.find(InventoryEntry, { user: userId }, {
      populate: ['card'],
      orderBy: { card: { name: 'asc' } },
    });
    return entries.map((e) => `${e.card.id},${e.card.name},${e.card.setCode},${e.quantity}`).join('\n');
  }

  async importVersionedCsv(userId: string, csv: string): Promise<{ imported: number; errors: string[] }> {
    const user = await this.em.findOneOrFail(User, userId);
    const lines = csv.split('\n').map((l) => l.trim()).filter(Boolean);
    let imported = 0;
    const errors: string[] = [];

    for (const line of lines) {
      const firstComma = line.indexOf(',');
      const lastComma = line.lastIndexOf(',');
      if (firstComma === -1 || firstComma === lastComma) { errors.push(`Invalid line: "${line}"`); continue; }
      const scryfallId = line.slice(0, firstComma).trim();
      const quantity = parseInt(line.slice(lastComma + 1).trim(), 10);
      if (!scryfallId || isNaN(quantity) || quantity < 1) { errors.push(`Invalid line: "${line}"`); continue; }

      try {
        const card = await this.scryfall.findById(scryfallId);
        const existing = await this.em.findOne(InventoryEntry, { user, card });
        if (existing) {
          existing.quantity = quantity;
        } else {
          this.em.persist(new InventoryEntry(user, card, quantity));
        }
        await this.em.flush();
        imported++;
      } catch {
        errors.push(`Card not found: "${scryfallId}"`);
      }
    }

    return { imported, errors };
  }

  async importCsv(userId: string, csv: string): Promise<{ imported: number; errors: string[] }> {
    const user = await this.em.findOneOrFail(User, userId);
    const lines = csv.split('\n').map((l) => l.trim()).filter(Boolean);
    let imported = 0;
    const errors: string[] = [];

    for (const line of lines) {
      const lastComma = line.lastIndexOf(',');
      if (lastComma === -1) { errors.push(`Invalid line: "${line}"`); continue; }
      const name = line.slice(0, lastComma).trim();
      const quantity = parseInt(line.slice(lastComma + 1).trim(), 10);
      if (!name || isNaN(quantity) || quantity < 1) { errors.push(`Invalid line: "${line}"`); continue; }

      try {
        const card = await this.scryfall.findByName(name);
        const existing = await this.em.findOne(InventoryEntry, { user, card });
        if (existing) {
          existing.quantity = quantity;
        } else {
          this.em.persist(new InventoryEntry(user, card, quantity));
        }
        await this.em.flush();
        imported++;
      } catch {
        errors.push(`Card not found: "${name}"`);
      }
    }

    return { imported, errors };
  }
}
