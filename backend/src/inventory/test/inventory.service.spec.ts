import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { InventoryService } from '../inventory.service';
import { ScryfallService } from '../../scryfall/scryfall.service';
import { InventoryEntry } from '../../entities/inventory-entry.entity';
import { User } from '../../entities/user.entity';
import { Card } from '../../entities/card.entity';
import { Deck } from '../../entities/deck.entity';
import { DeckCard } from '../../entities/deck-card.entity';

const mockEm = {
  findOne: jest.fn(),
  findOneOrFail: jest.fn(),
  find: jest.fn(),
  persist: jest.fn(),
  remove: jest.fn(),
  flush: jest.fn(),
};

const mockScryfall = {
  findById: jest.fn(),
};

function makeUser(): User {
  const user = new User('test@example.com', 'hash');
  Object.assign(user, { id: 'user-1' });
  return user;
}

function makeCard(overrides: Partial<Card> = {}): Card {
  const card = new Card('card-1', 'Lightning Bolt', 'https://scryfall.com', 1, 'Instant', 'common', 'lea', 'Alpha', [], { standard: 'not_legal', commander: 'legal' });
  return Object.assign(card, overrides);
}

function makeEntry(user: User, card: Card, quantity = 2): InventoryEntry {
  const entry = new InventoryEntry(user, card, quantity);
  Object.assign(entry, { id: 'entry-1' });
  return entry;
}

describe('InventoryService', () => {
  let service: InventoryService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: EntityManager, useValue: mockEm },
        { provide: ScryfallService, useValue: mockScryfall },
      ],
    }).compile();

    service = module.get(InventoryService);
  });

  describe('list', () => {
    it('should return entries with inDecks populated', async () => {
      const user = makeUser();
      const card = makeCard();
      const entry = makeEntry(user, card);
      const deck = { id: 'deck-1', name: 'My Deck' } as Deck;
      const deckCard = { card: { id: card.id }, deck, quantity: 1 } as unknown as DeckCard;

      mockEm.find
        .mockResolvedValueOnce([entry])    // InventoryEntry query
        .mockResolvedValueOnce([deck])      // Deck query
        .mockResolvedValueOnce([deckCard]); // DeckCard query

      const result = await service.list('user-1', {});

      expect(result).toHaveLength(1);
      expect(result[0].inDecks).toEqual([{ id: 'deck-1', name: 'My Deck', quantity: 1 }]);
    });

    it('should return an empty inDecks array when no deck cards exist for a card', async () => {
      const user = makeUser();
      const card = makeCard();
      const entry = makeEntry(user, card);

      mockEm.find
        .mockResolvedValueOnce([entry])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.list('user-1', {});

      expect(result[0].inDecks).toEqual([]);
    });

    it('should pass $ilike filter on card.name when name filter is provided', async () => {
      mockEm.find
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await service.list('user-1', { name: 'bolt' });

      expect(mockEm.find).toHaveBeenNthCalledWith(
        1,
        InventoryEntry,
        { user: 'user-1', card: { name: { $ilike: '%bolt%' } } },
        expect.any(Object),
      );
    });

    it('should pass $overlap filter on card.colors when colors filter is provided', async () => {
      mockEm.find
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await service.list('user-1', { colors: ['R'] });

      expect(mockEm.find).toHaveBeenNthCalledWith(
        1,
        InventoryEntry,
        { user: 'user-1', card: { colors: { $overlap: ['R'] } } },
        expect.any(Object),
      );
    });

    it('should not add card filter when no filter fields are provided', async () => {
      mockEm.find
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await service.list('user-1', {});

      expect(mockEm.find).toHaveBeenNthCalledWith(
        1,
        InventoryEntry,
        { user: 'user-1' },
        expect.any(Object),
      );
    });
  });

  describe('add', () => {
    it('should create a new InventoryEntry when none exists', async () => {
      const user = makeUser();
      const card = makeCard();

      mockScryfall.findById.mockResolvedValueOnce(card);
      mockEm.findOneOrFail.mockResolvedValueOnce(user);
      mockEm.findOne.mockResolvedValueOnce(null); // no existing entry

      const result = await service.add('user-1', 'card-1', 1);

      expect(mockEm.persist).toHaveBeenCalledWith(expect.any(InventoryEntry));
      expect(mockEm.flush).toHaveBeenCalledTimes(1);
      expect(result).toBeInstanceOf(InventoryEntry);
      expect(result.quantity).toBe(1);
    });

    it('should increment quantity on an existing InventoryEntry', async () => {
      const user = makeUser();
      const card = makeCard();
      const existing = makeEntry(user, card, 3);

      mockScryfall.findById.mockResolvedValueOnce(card);
      mockEm.findOneOrFail.mockResolvedValueOnce(user);
      mockEm.findOne.mockResolvedValueOnce(existing);

      const result = await service.add('user-1', 'card-1', 2);

      expect(result.quantity).toBe(5);
      expect(mockEm.persist).not.toHaveBeenCalled();
      expect(mockEm.flush).toHaveBeenCalledTimes(1);
    });

    it('should call scryfall.findById with the provided cardId', async () => {
      const user = makeUser();
      const card = makeCard();

      mockScryfall.findById.mockResolvedValueOnce(card);
      mockEm.findOneOrFail.mockResolvedValueOnce(user);
      mockEm.findOne.mockResolvedValueOnce(null);

      await service.add('user-1', 'card-1', 1);

      expect(mockScryfall.findById).toHaveBeenCalledWith('card-1');
    });
  });

  describe('update', () => {
    it('should update the quantity and return the entry', async () => {
      const user = makeUser();
      const card = makeCard();
      const entry = makeEntry(user, card, 2);
      mockEm.findOne.mockResolvedValueOnce(entry);

      const result = await service.update('user-1', 'entry-1', 5);

      expect(result.quantity).toBe(5);
      expect(mockEm.flush).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when the entry is not found', async () => {
      mockEm.findOne.mockResolvedValueOnce(null);

      await expect(service.update('user-1', 'entry-1', 5)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should call em.remove and em.flush when entry exists', async () => {
      const user = makeUser();
      const card = makeCard();
      const entry = makeEntry(user, card);
      mockEm.findOne.mockResolvedValueOnce(entry);

      await service.remove('user-1', 'entry-1');

      expect(mockEm.remove).toHaveBeenCalledWith(entry);
      expect(mockEm.flush).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when the entry is not found', async () => {
      mockEm.findOne.mockResolvedValueOnce(null);

      await expect(service.remove('user-1', 'entry-1')).rejects.toThrow(NotFoundException);
    });
  });
});
