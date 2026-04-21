import { Entity, PrimaryKey, Property, OneToMany, Collection } from '@mikro-orm/core';
import { InventoryEntry } from './inventory-entry.entity';
import { DeckCard } from './deck-card.entity';

@Entity()
export class Card {
  @PrimaryKey()
  id: string; // Scryfall UUID

  @Property()
  name: string;

  @Property()
  scryfallUri: string;

  @Property({ nullable: true })
  imageUri: string | null = null;

  @Property({ nullable: true })
  manaCost: string | null = null;

  @Property()
  cmc: number;

  @Property()
  typeLine: string;

  @Property({ nullable: true, columnType: 'text' })
  oracleText: string | null = null;

  @Property({ type: 'array' })
  colors: string[] = [];

  @Property({ type: 'array' })
  colorIdentity: string[] = [];

  @Property()
  rarity: string;

  @Property()
  setCode: string;

  @Property()
  setName: string;

  @Property()
  isBasicLand: boolean = false;

  @Property({ type: 'json' })
  legalities: Record<string, string>;

  @Property()
  cachedAt: Date = new Date();

  @OneToMany(() => InventoryEntry, (entry) => entry.card)
  inventory = new Collection<InventoryEntry>(this);

  @OneToMany(() => DeckCard, (dc) => dc.card)
  deckCards = new Collection<DeckCard>(this);

  constructor(id: string, name: string, scryfallUri: string, cmc: number, typeLine: string, rarity: string, setCode: string, setName: string, colorIdentity: string[], legalities: Record<string, string>) {
    this.id = id;
    this.name = name;
    this.scryfallUri = scryfallUri;
    this.cmc = cmc;
    this.typeLine = typeLine;
    this.rarity = rarity;
    this.setCode = setCode;
    this.setName = setName;
    this.colorIdentity = colorIdentity;
    this.legalities = legalities;
  }
}
