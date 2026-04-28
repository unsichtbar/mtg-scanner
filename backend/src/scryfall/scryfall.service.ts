import { Injectable, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { EntityManager } from '@mikro-orm/core';
import { firstValueFrom } from 'rxjs';
import { Card } from '../entities/card.entity';

interface ScryfallCard {
  id: string;
  name: string;
  scryfall_uri: string;
  image_uris?: { normal?: string };
  card_faces?: { image_uris?: { normal?: string } }[];
  mana_cost?: string;
  cmc: number;
  type_line: string;
  oracle_text?: string;
  colors?: string[];
  color_identity: string[];
  rarity: string;
  set: string;
  set_name: string;
  legalities: Record<string, string>;
  prices: Record<string, string | null>;
}

@Injectable()
export class ScryfallService {
  // Tracks card names whose full printings have been fetched from Scryfall this
  // server session. On repeat requests we serve from DB instead of re-hitting
  // the API. Cards are always persisted via upsertCard on first fetch.
  private readonly fetchedPrintingNames = new Set<string>();

  constructor(
    private readonly http: HttpService,
    private readonly em: EntityManager,
  ) {}

  async findByName(name: string): Promise<Card> {
    const cached = await this.em.findOne(Card, { name: { $ilike: name } });
    if (cached) return cached;

    const { data } = await firstValueFrom(
      this.http.get<ScryfallCard>('/cards/named', { params: { fuzzy: name } }),
    ).catch(() => {
      throw new NotFoundException(`Card "${name}" not found on Scryfall`);
    });

    return this.upsertCard(data);
  }

  async findPrintings(name: string): Promise<Card[]> {
    if (this.fetchedPrintingNames.has(name)) {
      return this.em.find(Card, { name }, { orderBy: { setName: 'asc' } });
    }

    const { data } = await firstValueFrom(
      this.http.get<{ data: ScryfallCard[] }>('/cards/search', {
        params: { q: `!"${name}"`, unique: 'prints', order: 'released', dir: 'desc' },
      }),
    ).catch(() => ({ data: { data: [] } }));

    const cards: Card[] = [];
    for (const sc of data.data.slice(0, 30)) {
      cards.push(await this.upsertCard(sc));
    }

    if (cards.length > 0) this.fetchedPrintingNames.add(name);
    return cards;
  }

  async search(query: string): Promise<Card[]> {
    const { data } = await firstValueFrom(
      this.http.get<{ data: ScryfallCard[] }>('/cards/search', {
        params: { q: query, order: 'name', unique: 'cards' },
      }),
    ).catch(() => ({ data: { data: [] } }));

    const cards: Card[] = [];
    for (const sc of data.data.slice(0, 20)) {
      cards.push(await this.upsertCard(sc));
    }
    return cards;
  }

  async findById(id: string): Promise<Card> {
    const cached = await this.em.findOne(Card, id);
    if (cached) return cached;

    const { data } = await firstValueFrom(
      this.http.get<ScryfallCard>(`/cards/${id}`),
    ).catch(() => {
      throw new NotFoundException(`Card "${id}" not found on Scryfall`);
    });

    return this.upsertCard(data);
  }

  private async upsertCard(data: ScryfallCard): Promise<Card> {
    const imageUri =
      data.image_uris?.normal ?? data.card_faces?.[0]?.image_uris?.normal ?? null;
    const isBasicLand = data.type_line?.toLowerCase().includes('basic land') ?? false;

    let card = await this.em.findOne(Card, data.id);
    if (card) {
      card.name = data.name;
      card.scryfallUri = data.scryfall_uri;
      card.imageUri = imageUri;
      card.manaCost = data.mana_cost ?? null;
      card.cmc = data.cmc;
      card.typeLine = data.type_line;
      card.oracleText = data.oracle_text ?? null;
      card.colors = data.colors ?? [];
      card.colorIdentity = data.color_identity;
      card.rarity = data.rarity;
      card.setCode = data.set;
      card.setName = data.set_name;
      card.isBasicLand = isBasicLand;
      card.legalities = data.legalities;
      card.prices = data.prices ?? null;
      card.cachedAt = new Date();
    } else {
      card = new Card(
        data.id, data.name, data.scryfall_uri, data.cmc,
        data.type_line, data.rarity, data.set, data.set_name,
        data.color_identity, data.legalities,
      );
      card.imageUri = imageUri;
      card.manaCost = data.mana_cost ?? null;
      card.oracleText = data.oracle_text ?? null;
      card.colors = data.colors ?? [];
      card.isBasicLand = isBasicLand;
      card.prices = data.prices ?? null;
    }

    this.em.persist(card);
    await this.em.flush();
    return card;
  }
}
