import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { ScryfallService } from '../scryfall/scryfall.service';
import { InventoryEntry } from '../entities/inventory-entry.entity';
import { User } from '../entities/user.entity';
import { Card } from '../entities/card.entity';
import { DeckCard } from '../entities/deck-card.entity';
import { Deck } from '../entities/deck.entity';

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

    // Attach deck membership for the current user
    const userDecks = await this.em.find(Deck, { user: userId });
    const deckCards = await this.em.find(DeckCard, {
      deck: { $in: userDecks.map((d) => d.id) },
    }, { populate: ['deck'] });

    const cardDeckMap = new Map<string, { id: string; name: string }[]>();
    for (const dc of deckCards) {
      const cardId = (dc.card as any).id ?? dc.card;
      if (!cardDeckMap.has(cardId)) cardDeckMap.set(cardId, []);
      cardDeckMap.get(cardId)!.push({ id: dc.deck.id, name: dc.deck.name });
    }

    return entries.map((entry) => ({
      ...entry,
      inDecks: cardDeckMap.get(entry.card.id) ?? [],
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
}
