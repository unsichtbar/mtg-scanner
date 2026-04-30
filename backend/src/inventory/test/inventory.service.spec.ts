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
import { Container } from '../../entities/container.entity';
import { ContainerCard } from '../../entities/container-card.entity';

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
  findByName: jest.fn(),
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

// Helper: set up the 5 em.find calls list() makes, with empty containers by default
function mockListFinds(
  entries: InventoryEntry[],
  decks: Deck[] = [],
  deckCards: DeckCard[] = [],
  containers: Container[] = [],
  containerCards: ContainerCard[] = [],
) {
  mockEm.find
    .mockResolvedValueOnce(entries)
    .mockResolvedValueOnce(decks)
    .mockResolvedValueOnce(deckCards)
    .mockResolvedValueOnce(containers)
    .mockResolvedValueOnce(containerCards);
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

      mockListFinds([entry], [deck], [deckCard]);

      const result = await service.list('user-1', {});

      expect(result).toHaveLength(1);
      expect(result[0].inDecks).toEqual([{ id: 'deck-1', name: 'My Deck', quantity: 1 }]);
    });

    it('should return an empty inDecks array when no deck cards exist for a card', async () => {
      const user = makeUser();
      mockListFinds([makeEntry(user, makeCard())]);

      const result = await service.list('user-1', {});

      expect(result[0].inDecks).toEqual([]);
    });

    it('should return entries with inContainers populated', async () => {
      const user = makeUser();
      const card = makeCard();
      const entry = makeEntry(user, card);
      const container = { id: 'container-1', name: 'Binder 1' } as Container;
      const cc = { card: { id: card.id }, container, quantity: 2 } as unknown as ContainerCard;

      mockListFinds([entry], [], [], [container], [cc]);

      const result = await service.list('user-1', {});

      expect(result[0].inContainers).toEqual([{ id: 'container-1', name: 'Binder 1', quantity: 2 }]);
    });

    it('should return an empty inContainers array when no container cards exist for a card', async () => {
      const user = makeUser();
      mockListFinds([makeEntry(user, makeCard())]);

      const result = await service.list('user-1', {});

      expect(result[0].inContainers).toEqual([]);
    });

    it('should pass $ilike filter on card.name when name filter is provided', async () => {
      mockListFinds([]);

      await service.list('user-1', { name: 'bolt' });

      expect(mockEm.find).toHaveBeenNthCalledWith(
        1,
        InventoryEntry,
        { user: 'user-1', card: { name: { $ilike: '%bolt%' } } },
        expect.any(Object),
      );
    });

    it('should pass $overlap filter on card.colors when colors filter is provided', async () => {
      mockListFinds([]);

      await service.list('user-1', { colors: ['R'] });

      expect(mockEm.find).toHaveBeenNthCalledWith(
        1,
        InventoryEntry,
        { user: 'user-1', card: { colors: { $overlap: ['R'] } } },
        expect.any(Object),
      );
    });

    it('should not add card filter when no filter fields are provided', async () => {
      mockListFinds([]);

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
      mockEm.findOne.mockResolvedValueOnce(null);

      const result = await service.add('user-1', 'card-1', 1);

      expect(mockEm.persist).toHaveBeenCalledWith(expect.any(InventoryEntry));
      expect(mockEm.flush).toHaveBeenCalledTimes(1);
      expect(result.quantity).toBe(1);
      expect(result.inDecks).toEqual([]);
      expect(result.inContainers).toEqual([]);
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
      expect(result.inDecks).toEqual([]);
      expect(result.inContainers).toEqual([]);
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

  describe('exportCsv', () => {
    it('should return name,quantity lines ordered by card name', async () => {
      const user = makeUser();
      const card1 = makeCard({ id: 'c1', name: 'Ancestral Recall' });
      const card2 = makeCard({ id: 'c2', name: 'Lightning Bolt' });
      mockEm.find.mockResolvedValueOnce([makeEntry(user, card1, 3), makeEntry(user, card2, 4)]);

      const result = await service.exportCsv('user-1');

      expect(result).toBe('Ancestral Recall,3\nLightning Bolt,4');
    });

    it('should return an empty string for an empty inventory', async () => {
      mockEm.find.mockResolvedValueOnce([]);

      expect(await service.exportCsv('user-1')).toBe('');
    });

    it('should handle card names containing commas', async () => {
      const user = makeUser();
      const card = makeCard({ name: 'Kongming, Sleeping Dragon' });
      mockEm.find.mockResolvedValueOnce([makeEntry(user, card, 1)]);

      const result = await service.exportCsv('user-1');

      expect(result).toBe('Kongming, Sleeping Dragon,1');
    });
  });

  describe('importCsv', () => {
    it('should create a new InventoryEntry and return imported count', async () => {
      const user = makeUser();
      const card = makeCard();
      mockEm.findOneOrFail.mockResolvedValueOnce(user);
      mockScryfall.findByName.mockResolvedValueOnce(card);
      mockEm.findOne.mockResolvedValueOnce(null);

      const result = await service.importCsv('user-1', 'Lightning Bolt,3');

      expect(result).toEqual({ imported: 1, errors: [] });
      expect(mockScryfall.findByName).toHaveBeenCalledWith('Lightning Bolt');
      expect(mockEm.persist).toHaveBeenCalledWith(expect.any(InventoryEntry));
    });

    it('should set quantity on an existing InventoryEntry', async () => {
      const user = makeUser();
      const card = makeCard();
      const existing = makeEntry(user, card, 2);
      mockEm.findOneOrFail.mockResolvedValueOnce(user);
      mockScryfall.findByName.mockResolvedValueOnce(card);
      mockEm.findOne.mockResolvedValueOnce(existing);

      await service.importCsv('user-1', 'Lightning Bolt,5');

      expect(existing.quantity).toBe(5);
      expect(mockEm.persist).not.toHaveBeenCalled();
    });

    it('should handle card names with commas via last-comma split', async () => {
      const user = makeUser();
      const card = makeCard({ name: 'Kongming, Sleeping Dragon' });
      mockEm.findOneOrFail.mockResolvedValueOnce(user);
      mockScryfall.findByName.mockResolvedValueOnce(card);
      mockEm.findOne.mockResolvedValueOnce(null);

      const result = await service.importCsv('user-1', 'Kongming, Sleeping Dragon,2');

      expect(result.imported).toBe(1);
      expect(mockScryfall.findByName).toHaveBeenCalledWith('Kongming, Sleeping Dragon');
    });

    it('should record an error for lines with no comma', async () => {
      mockEm.findOneOrFail.mockResolvedValueOnce(makeUser());

      const result = await service.importCsv('user-1', 'InvalidLine');

      expect(result.imported).toBe(0);
      expect(result.errors).toHaveLength(1);
    });

    it('should record an error when the card is not found on Scryfall', async () => {
      mockEm.findOneOrFail.mockResolvedValueOnce(makeUser());
      mockScryfall.findByName.mockRejectedValueOnce(new Error('Not found'));

      const result = await service.importCsv('user-1', 'Nonexistent Card,1');

      expect(result.imported).toBe(0);
      expect(result.errors[0]).toContain('Card not found');
    });

    it('should skip blank lines without counting them as errors', async () => {
      mockEm.findOneOrFail.mockResolvedValueOnce(makeUser());

      const result = await service.importCsv('user-1', '\n  \n\n');

      expect(result).toEqual({ imported: 0, errors: [] });
    });

    it('should process multiple lines independently', async () => {
      const user = makeUser();
      const card = makeCard();
      mockEm.findOneOrFail.mockResolvedValueOnce(user);
      mockScryfall.findByName
        .mockResolvedValueOnce(card)
        .mockRejectedValueOnce(new Error('Not found'));
      mockEm.findOne.mockResolvedValueOnce(null);

      const result = await service.importCsv('user-1', 'Lightning Bolt,1\nFake Card,2');

      expect(result.imported).toBe(1);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('exportVersionedCsv', () => {
    it('should return scryfall_id,name,set_code,quantity lines', async () => {
      const user = makeUser();
      const card = makeCard({ id: 'abc-uuid', name: 'Lightning Bolt', setCode: 'lea' });
      mockEm.find.mockResolvedValueOnce([makeEntry(user, card, 4)]);

      const result = await service.exportVersionedCsv('user-1');

      expect(result).toBe('abc-uuid,Lightning Bolt,lea,4');
    });

    it('should return an empty string for an empty inventory', async () => {
      mockEm.find.mockResolvedValueOnce([]);

      expect(await service.exportVersionedCsv('user-1')).toBe('');
    });
  });

  describe('importVersionedCsv', () => {
    it('should create a new entry using scryfall.findById for the Scryfall ID', async () => {
      const user = makeUser();
      const card = makeCard({ id: 'abc-uuid' });
      mockEm.findOneOrFail.mockResolvedValueOnce(user);
      mockScryfall.findById.mockResolvedValueOnce(card);
      mockEm.findOne.mockResolvedValueOnce(null);

      const result = await service.importVersionedCsv('user-1', 'abc-uuid,Lightning Bolt,lea,3');

      expect(result).toEqual({ imported: 1, errors: [] });
      expect(mockScryfall.findById).toHaveBeenCalledWith('abc-uuid');
      expect(mockEm.persist).toHaveBeenCalledWith(expect.any(InventoryEntry));
    });

    it('should set quantity on an existing entry', async () => {
      const user = makeUser();
      const card = makeCard();
      const existing = makeEntry(user, card, 1);
      mockEm.findOneOrFail.mockResolvedValueOnce(user);
      mockScryfall.findById.mockResolvedValueOnce(card);
      mockEm.findOne.mockResolvedValueOnce(existing);

      await service.importVersionedCsv('user-1', 'card-1,Lightning Bolt,lea,4');

      expect(existing.quantity).toBe(4);
    });

    it('should error on a line with only one comma (missing required fields)', async () => {
      mockEm.findOneOrFail.mockResolvedValueOnce(makeUser());

      const result = await service.importVersionedCsv('user-1', 'id,3');

      expect(result.imported).toBe(0);
      expect(result.errors).toHaveLength(1);
    });

    it('should error on a line with no comma', async () => {
      mockEm.findOneOrFail.mockResolvedValueOnce(makeUser());

      const result = await service.importVersionedCsv('user-1', 'justanid');

      expect(result.imported).toBe(0);
      expect(result.errors).toHaveLength(1);
    });

    it('should add an error when findById fails', async () => {
      mockEm.findOneOrFail.mockResolvedValueOnce(makeUser());
      mockScryfall.findById.mockRejectedValueOnce(new NotFoundException('Not found'));

      const result = await service.importVersionedCsv('user-1', 'bad-uuid,Unknown,set,1');

      expect(result.imported).toBe(0);
      expect(result.errors[0]).toContain('bad-uuid');
    });
  });
});
