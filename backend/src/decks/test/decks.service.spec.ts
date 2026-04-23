import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { DecksService } from '../decks.service';
import { ScryfallService } from '../../scryfall/scryfall.service';
import { Deck, GameFormat } from '../../entities/deck.entity';
import { DeckCard } from '../../entities/deck-card.entity';
import { User } from '../../entities/user.entity';
import { Card } from '../../entities/card.entity';

const mockEm = {
  findOne: jest.fn(),
  findOneOrFail: jest.fn(),
  find: jest.fn(),
  persist: jest.fn(),
  remove: jest.fn(),
  flush: jest.fn(),
  nativeDelete: jest.fn(),
};

const mockScryfall = {
  findById: jest.fn(),
};

function makeUser(): User {
  return Object.assign(new User('test@example.com', 'hash'), { id: 'user-1' });
}

function makeCard(overrides: Partial<Card> = {}): Card {
  const card = new Card(
    'card-1', 'Lightning Bolt', 'https://scryfall.com', 1,
    'Instant', 'common', 'lea', 'Alpha', [], { standard: 'not_legal', commander: 'legal' },
  );
  card.isBasicLand = false;
  return Object.assign(card, overrides);
}

function makeDeck(format = GameFormat.Standard): Deck {
  return Object.assign(new Deck(makeUser(), 'Test Deck', format), { id: 'deck-1' });
}

/** Builds a fake deck with a mocked MikroORM Collection for validate() tests */
function makeDeckWithCards(
  format: GameFormat,
  cards: Array<{ card: Partial<Card>; quantity: number }>,
) {
  return {
    id: 'deck-1',
    format,
    user: { id: 'user-1' },
    cards: { getItems: () => cards },
  };
}

describe('DecksService', () => {
  let service: DecksService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DecksService,
        { provide: EntityManager, useValue: mockEm },
        { provide: ScryfallService, useValue: mockScryfall },
      ],
    }).compile();

    service = module.get(DecksService);
  });

  describe('list', () => {
    it('should query decks for the user ordered by updatedAt desc', async () => {
      const deck = makeDeck();
      mockEm.find.mockResolvedValueOnce([deck]);

      const result = await service.list('user-1');

      expect(mockEm.find).toHaveBeenCalledWith(
        Deck,
        { user: 'user-1' },
        { orderBy: { updatedAt: 'desc' } },
      );
      expect(result).toEqual([deck]);
    });

    it('should return an empty array when the user has no decks', async () => {
      mockEm.find.mockResolvedValueOnce([]);
      const result = await service.list('user-1');
      expect(result).toEqual([]);
    });
  });

  describe('create', () => {
    it('should persist a new Deck and return it', async () => {
      const user = makeUser();
      mockEm.findOneOrFail.mockResolvedValueOnce(user);

      const result = await service.create('user-1', 'My Deck', GameFormat.Standard);

      expect(mockEm.persist).toHaveBeenCalledWith(expect.any(Deck));
      expect(mockEm.flush).toHaveBeenCalledTimes(1);
      expect(result).toBeInstanceOf(Deck);
      expect(result.name).toBe('My Deck');
      expect(result.format).toBe(GameFormat.Standard);
    });
  });

  describe('get', () => {
    it('should return the deck with populated cards', async () => {
      const deck = makeDeck();
      mockEm.findOne.mockResolvedValueOnce(deck);

      const result = await service.get('user-1', 'deck-1');

      expect(mockEm.findOne).toHaveBeenCalledWith(
        Deck,
        { id: 'deck-1', user: 'user-1' },
        { populate: ['cards', 'cards.card'] },
      );
      expect(result).toBe(deck);
    });

    it('should throw NotFoundException when deck is not found', async () => {
      mockEm.findOne.mockResolvedValueOnce(null);
      await expect(service.get('user-1', 'deck-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('addCard', () => {
    it('should create a new DeckCard when the card is not yet in the deck', async () => {
      const deck = makeDeck();
      const card = makeCard();
      mockEm.findOne
        .mockResolvedValueOnce(deck)  // ensureOwner
        .mockResolvedValueOnce(null); // no existing DeckCard
      mockScryfall.findById.mockResolvedValueOnce(card);

      const result = await service.addCard('user-1', 'deck-1', 'card-1', 1);

      expect(mockEm.persist).toHaveBeenCalledWith(expect.any(DeckCard));
      expect(mockEm.flush).toHaveBeenCalledTimes(1);
      expect(result).toBeInstanceOf(DeckCard);
      expect(result!.quantity).toBe(1);
    });

    it('should increment the quantity of an existing DeckCard', async () => {
      const deck = makeDeck();
      const card = makeCard();
      const existing = new DeckCard(deck, card, 2);
      mockEm.findOne
        .mockResolvedValueOnce(deck)     // ensureOwner
        .mockResolvedValueOnce(existing); // existing DeckCard
      mockScryfall.findById.mockResolvedValueOnce(card);

      const result = await service.addCard('user-1', 'deck-1', 'card-1', 1);

      expect(result!.quantity).toBe(3);
      expect(mockEm.persist).not.toHaveBeenCalled();
      expect(mockEm.flush).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when deck is not owned by user', async () => {
      mockEm.findOne.mockResolvedValueOnce(null); // ensureOwner returns null
      await expect(service.addCard('user-1', 'deck-1', 'card-1', 1)).rejects.toThrow(NotFoundException);
    });
  });

  describe('setCardQuantity', () => {
    it('should update the DeckCard quantity and return it', async () => {
      const deck = makeDeck();
      const card = makeCard({ isBasicLand: false });
      const deckCard = Object.assign(new DeckCard(deck, card, 1), { card });
      mockEm.findOne
        .mockResolvedValueOnce(deck)    // ensureOwner
        .mockResolvedValueOnce(deckCard); // DeckCard

      const result = await service.setCardQuantity('user-1', 'deck-1', 'card-1', 3);

      expect(result!.quantity).toBe(3);
      expect(mockEm.flush).toHaveBeenCalledTimes(1);
    });

    it('should remove the DeckCard and return null when quantity is 0', async () => {
      const deck = makeDeck();
      const card = makeCard();
      const deckCard = Object.assign(new DeckCard(deck, card, 2), { card });
      mockEm.findOne
        .mockResolvedValueOnce(deck)
        .mockResolvedValueOnce(deckCard);

      const result = await service.setCardQuantity('user-1', 'deck-1', 'card-1', 0);

      expect(result).toBeNull();
      expect(mockEm.remove).toHaveBeenCalledWith(deckCard);
      expect(mockEm.flush).toHaveBeenCalledTimes(1);
    });

    it('should remove the DeckCard and return null when quantity is negative', async () => {
      const deck = makeDeck();
      const card = makeCard();
      const deckCard = Object.assign(new DeckCard(deck, card, 1), { card });
      mockEm.findOne
        .mockResolvedValueOnce(deck)
        .mockResolvedValueOnce(deckCard);

      const result = await service.setCardQuantity('user-1', 'deck-1', 'card-1', -1);

      expect(result).toBeNull();
      expect(mockEm.remove).toHaveBeenCalled();
    });

    it('[Standard] should throw when setting >4 copies of a non-basic land', async () => {
      const deck = makeDeck(GameFormat.Standard);
      const card = makeCard({ isBasicLand: false });
      const deckCard = Object.assign(new DeckCard(deck, card, 1), { card });
      mockEm.findOne
        .mockResolvedValueOnce(deck)
        .mockResolvedValueOnce(deckCard);

      await expect(service.setCardQuantity('user-1', 'deck-1', 'card-1', 5)).rejects.toThrow(
        /Standard allows at most 4 copies/,
      );
    });

    it('[Standard] should allow >4 copies of a basic land', async () => {
      const deck = makeDeck(GameFormat.Standard);
      const card = makeCard({ isBasicLand: true });
      const deckCard = Object.assign(new DeckCard(deck, card, 1), { card });
      mockEm.findOne
        .mockResolvedValueOnce(deck)
        .mockResolvedValueOnce(deckCard);

      const result = await service.setCardQuantity('user-1', 'deck-1', 'card-1', 10);

      expect(result!.quantity).toBe(10);
    });

    it('[Commander] should throw when setting >1 copy of a non-basic land', async () => {
      const deck = makeDeck(GameFormat.Commander);
      const card = makeCard({ isBasicLand: false });
      const deckCard = Object.assign(new DeckCard(deck, card, 1), { card });
      mockEm.findOne
        .mockResolvedValueOnce(deck)
        .mockResolvedValueOnce(deckCard);

      await expect(service.setCardQuantity('user-1', 'deck-1', 'card-1', 2)).rejects.toThrow(
        /Commander allows at most 1 copy/,
      );
    });

    it('[Commander] should allow >1 copy of a basic land', async () => {
      const deck = makeDeck(GameFormat.Commander);
      const card = makeCard({ isBasicLand: true });
      const deckCard = Object.assign(new DeckCard(deck, card, 1), { card });
      mockEm.findOne
        .mockResolvedValueOnce(deck)
        .mockResolvedValueOnce(deckCard);

      const result = await service.setCardQuantity('user-1', 'deck-1', 'card-1', 5);

      expect(result!.quantity).toBe(5);
    });

    it('should throw NotFoundException when the card is not in the deck', async () => {
      const deck = makeDeck();
      mockEm.findOne
        .mockResolvedValueOnce(deck)
        .mockResolvedValueOnce(null); // no DeckCard

      await expect(service.setCardQuantity('user-1', 'deck-1', 'card-1', 2)).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeCard', () => {
    it('should remove the DeckCard and flush', async () => {
      const deck = makeDeck();
      const card = makeCard();
      const deckCard = new DeckCard(deck, card, 1);
      mockEm.findOne
        .mockResolvedValueOnce(deck)
        .mockResolvedValueOnce(deckCard);

      await service.removeCard('user-1', 'deck-1', 'card-1');

      expect(mockEm.remove).toHaveBeenCalledWith(deckCard);
      expect(mockEm.flush).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when the card is not in the deck', async () => {
      const deck = makeDeck();
      mockEm.findOne
        .mockResolvedValueOnce(deck)
        .mockResolvedValueOnce(null);

      await expect(service.removeCard('user-1', 'deck-1', 'card-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when the deck is not owned by user', async () => {
      mockEm.findOne.mockResolvedValueOnce(null);
      await expect(service.removeCard('user-1', 'deck-1', 'card-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('validate', () => {
    describe('Standard format', () => {
      it('should return valid:true for a legal 60-card deck', async () => {
        const deck = makeDeckWithCards(GameFormat.Standard, [
          { card: { name: 'Forest', isBasicLand: true, legalities: { standard: 'legal' } }, quantity: 60 },
        ]);
        mockEm.findOne.mockResolvedValueOnce(deck);

        const result = await service.validate('user-1', 'deck-1');

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should return an error when deck has fewer than 60 cards', async () => {
        const deck = makeDeckWithCards(GameFormat.Standard, [
          { card: { name: 'Forest', isBasicLand: true, legalities: { standard: 'legal' } }, quantity: 59 },
        ]);
        mockEm.findOne.mockResolvedValueOnce(deck);

        const result = await service.validate('user-1', 'deck-1');

        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.message.includes('59 cards'))).toBe(true);
      });

      it('should return an error when a non-basic card has more than 4 copies', async () => {
        const deck = makeDeckWithCards(GameFormat.Standard, [
          { card: { name: 'Lightning Bolt', isBasicLand: false, legalities: { standard: 'legal' } }, quantity: 5 },
          { card: { name: 'Forest', isBasicLand: true, legalities: { standard: 'legal' } }, quantity: 55 },
        ]);
        mockEm.findOne.mockResolvedValueOnce(deck);

        const result = await service.validate('user-1', 'deck-1');

        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.message.includes('"Lightning Bolt"') && e.message.includes('5 copies'))).toBe(true);
      });

      it('should return an error when a card is not legal in Standard', async () => {
        const deck = makeDeckWithCards(GameFormat.Standard, [
          { card: { name: 'Black Lotus', isBasicLand: false, legalities: { standard: 'not_legal' } }, quantity: 1 },
          { card: { name: 'Forest', isBasicLand: true, legalities: { standard: 'legal' } }, quantity: 59 },
        ]);
        mockEm.findOne.mockResolvedValueOnce(deck);

        const result = await service.validate('user-1', 'deck-1');

        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.message.includes('"Black Lotus"') && e.message.includes('not legal in Standard'))).toBe(true);
      });

      it('should not flag a basic land for exceeding 4 copies', async () => {
        const deck = makeDeckWithCards(GameFormat.Standard, [
          { card: { name: 'Forest', isBasicLand: true, legalities: { standard: 'legal' } }, quantity: 60 },
        ]);
        mockEm.findOne.mockResolvedValueOnce(deck);

        const result = await service.validate('user-1', 'deck-1');

        expect(result.errors.every((e) => !e.message.includes('Forest'))).toBe(true);
      });
    });

    describe('Commander format', () => {
      it('should return valid:true for a legal 100-card deck', async () => {
        const deck = makeDeckWithCards(GameFormat.Commander, [
          { card: { name: 'Sol Ring', isBasicLand: false, legalities: { commander: 'legal' } }, quantity: 1 },
          { card: { name: 'Forest', isBasicLand: true, legalities: { commander: 'legal' } }, quantity: 99 },
        ]);
        mockEm.findOne.mockResolvedValueOnce(deck);

        const result = await service.validate('user-1', 'deck-1');

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should return an error when deck does not have exactly 100 cards', async () => {
        const deck = makeDeckWithCards(GameFormat.Commander, [
          { card: { name: 'Sol Ring', isBasicLand: false, legalities: { commander: 'legal' } }, quantity: 99 },
        ]);
        mockEm.findOne.mockResolvedValueOnce(deck);

        const result = await service.validate('user-1', 'deck-1');

        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.message.includes('99 cards'))).toBe(true);
      });

      it('should return an error when a non-basic card has more than 1 copy', async () => {
        const deck = makeDeckWithCards(GameFormat.Commander, [
          { card: { name: 'Sol Ring', isBasicLand: false, legalities: { commander: 'legal' } }, quantity: 2 },
          { card: { name: 'Forest', isBasicLand: true, legalities: { commander: 'legal' } }, quantity: 98 },
        ]);
        mockEm.findOne.mockResolvedValueOnce(deck);

        const result = await service.validate('user-1', 'deck-1');

        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.message.includes('"Sol Ring"') && e.message.includes('2 copies'))).toBe(true);
      });

      it('should return an error when a card is not legal in Commander', async () => {
        const deck = makeDeckWithCards(GameFormat.Commander, [
          { card: { name: 'Black Lotus', isBasicLand: false, legalities: { commander: 'banned' } }, quantity: 1 },
          { card: { name: 'Forest', isBasicLand: true, legalities: { commander: 'legal' } }, quantity: 99 },
        ]);
        mockEm.findOne.mockResolvedValueOnce(deck);

        const result = await service.validate('user-1', 'deck-1');

        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.message.includes('"Black Lotus"') && e.message.includes('not legal in Commander'))).toBe(true);
      });

      it('should not flag basic lands for copy count violations', async () => {
        const deck = makeDeckWithCards(GameFormat.Commander, [
          { card: { name: 'Sol Ring', isBasicLand: false, legalities: { commander: 'legal' } }, quantity: 1 },
          { card: { name: 'Forest', isBasicLand: true, legalities: { commander: 'legal' } }, quantity: 99 },
        ]);
        mockEm.findOne.mockResolvedValueOnce(deck);

        const result = await service.validate('user-1', 'deck-1');

        expect(result.errors.every((e) => !e.message.includes('Forest'))).toBe(true);
      });
    });
  });

  describe('delete', () => {
    it('should delete all DeckCards, remove the deck, and flush', async () => {
      const deck = makeDeck();
      mockEm.findOne.mockResolvedValueOnce(deck);
      mockEm.nativeDelete.mockResolvedValueOnce(5);

      await service.delete('user-1', 'deck-1');

      expect(mockEm.nativeDelete).toHaveBeenCalledWith(DeckCard, { deck: deck.id });
      expect(mockEm.remove).toHaveBeenCalledWith(deck);
      expect(mockEm.flush).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when the deck is not owned by user', async () => {
      mockEm.findOne.mockResolvedValueOnce(null);
      await expect(service.delete('user-1', 'deck-1')).rejects.toThrow(NotFoundException);
    });
  });
});
