import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { ScryfallService } from '../scryfall/scryfall.service';
import { Deck, GameFormat } from '../entities/deck.entity';
import { DeckCard } from '../entities/deck-card.entity';
import { User } from '../entities/user.entity';

@Injectable()
export class DecksService {
  constructor(
    private readonly em: EntityManager,
    private readonly scryfall: ScryfallService,
  ) {}

  async list(userId: string) {
    return this.em.find(Deck, { user: userId }, { orderBy: { updatedAt: 'desc' } });
  }

  async get(userId: string, deckId: string) {
    const deck = await this.em.findOne(Deck, { id: deckId, user: userId }, {
      populate: ['cards', 'cards.card'],
    });
    if (!deck) throw new NotFoundException('Deck not found');
    return deck;
  }

  async create(userId: string, name: string, format: GameFormat) {
    const user = await this.em.findOneOrFail(User, userId);
    const deck = new Deck(user, name, format);
    this.em.persist(deck);
    await this.em.flush();
    return deck;
  }

  async addCard(userId: string, deckId: string, cardId: string, quantity: number) {
    const deck = await this.ensureOwner(userId, deckId);
    const card = await this.scryfall.findById(cardId);

    const existing = await this.em.findOne(DeckCard, { deck, card });
    if (existing) {
      existing.quantity += quantity;
      await this.em.flush();
      return existing;
    }

    const deckCard = new DeckCard(deck, card, quantity);
    this.em.persist(deckCard);
    await this.em.flush();
    return deckCard;
  }

  async setCardQuantity(userId: string, deckId: string, cardId: string, quantity: number) {
    const deck = await this.ensureOwner(userId, deckId);
    const deckCard = await this.em.findOne(DeckCard, { deck, card: cardId }, { populate: ['card'] });
    if (!deckCard) throw new NotFoundException('Card not in deck');

    if (quantity <= 0) {
      this.em.remove(deckCard);
      await this.em.flush();
      return null;
    }

    const isBasicLand = deckCard.card.isBasicLand;
    const maxCopies = deck.format === GameFormat.Commander ? 1 : 4;
    if (!isBasicLand && quantity > maxCopies) {
      throw new Error(`${deck.format === GameFormat.Commander ? 'Commander' : 'Standard'} allows at most ${maxCopies} cop${maxCopies === 1 ? 'y' : 'ies'} of non-basic land cards`);
    }

    deckCard.quantity = quantity;
    await this.em.flush();
    return deckCard;
  }

  async removeCard(userId: string, deckId: string, cardId: string) {
    const deck = await this.ensureOwner(userId, deckId);
    const deckCard = await this.em.findOne(DeckCard, { deck, card: cardId });
    if (!deckCard) throw new NotFoundException('Card not in deck');
    this.em.remove(deckCard);
    await this.em.flush();
  }

  async validate(userId: string, deckId: string) {
    const deck = await this.get(userId, deckId);
    const errors: { message: string }[] = [];
    const cards = deck.cards.getItems();
    const totalCards = cards.reduce((sum, dc) => sum + dc.quantity, 0);

    if (deck.format === GameFormat.Standard) {
      if (totalCards < 60)
        errors.push({ message: `Deck has ${totalCards} cards; Standard requires at least 60.` });
      for (const dc of cards) {
        if (!dc.card.isBasicLand && dc.quantity > 4)
          errors.push({ message: `"${dc.card.name}" has ${dc.quantity} copies; maximum is 4.` });
        if (dc.card.legalities['standard'] !== 'legal')
          errors.push({ message: `"${dc.card.name}" is not legal in Standard.` });
      }
    }

    if (deck.format === GameFormat.Commander) {
      if (totalCards !== 100)
        errors.push({ message: `Deck has ${totalCards} cards; Commander requires exactly 100.` });
      for (const dc of cards) {
        if (!dc.card.isBasicLand && dc.quantity > 1)
          errors.push({ message: `"${dc.card.name}" has ${dc.quantity} copies; Commander allows only 1 of each non-basic land.` });
        if (dc.card.legalities['commander'] !== 'legal')
          errors.push({ message: `"${dc.card.name}" is not legal in Commander.` });
      }
    }

    return { valid: errors.length === 0, errors };
  }

  async delete(userId: string, deckId: string) {
    const deck = await this.ensureOwner(userId, deckId);
    await this.em.nativeDelete(DeckCard, { deck: deck.id });
    this.em.remove(deck);
    await this.em.flush();
  }

  private async ensureOwner(userId: string, deckId: string) {
    const deck = await this.em.findOne(Deck, { id: deckId, user: userId });
    if (!deck) throw new NotFoundException('Deck not found');
    return deck;
  }
}
