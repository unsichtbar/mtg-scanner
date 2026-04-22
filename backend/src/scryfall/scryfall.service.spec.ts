import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { ScryfallService } from './scryfall.service';
import { Card } from '../entities/card.entity';

const mockEm = {
  findOne: jest.fn(),
  persist: jest.fn(),
  flush: jest.fn(),
};

const mockHttp = {
  get: jest.fn(),
};

const scryfallCardFixture = {
  id: 'scryfall-uuid-1',
  name: 'Lightning Bolt',
  scryfall_uri: 'https://scryfall.com/card/lea/161/lightning-bolt',
  image_uris: { normal: 'https://cards.scryfall.io/normal/front/lightning-bolt.jpg' },
  mana_cost: '{R}',
  cmc: 1,
  type_line: 'Instant',
  oracle_text: 'Lightning Bolt deals 3 damage to any target.',
  colors: ['R'],
  color_identity: ['R'],
  rarity: 'common',
  set: 'lea',
  set_name: 'Limited Edition Alpha',
  legalities: { standard: 'not_legal', commander: 'legal' },
  prices: { usd: '0.50', usd_foil: null },
};

describe('ScryfallService', () => {
  let service: ScryfallService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScryfallService,
        { provide: EntityManager, useValue: mockEm },
        { provide: HttpService, useValue: mockHttp },
      ],
    }).compile();

    service = module.get(ScryfallService);
  });

  describe('findByName', () => {
    it('should return a cached card without making an HTTP call', async () => {
      const cachedCard = new Card('scryfall-uuid-1', 'Lightning Bolt', 'https://scryfall.com', 1, 'Instant', 'common', 'lea', 'Alpha', ['R'], {});
      mockEm.findOne.mockResolvedValueOnce(cachedCard);

      const result = await service.findByName('lightning bolt');

      expect(result).toBe(cachedCard);
      expect(mockHttp.get).not.toHaveBeenCalled();
    });

    it('should fetch from Scryfall when the card is not cached, upsert it, and return it', async () => {
      mockEm.findOne
        .mockResolvedValueOnce(null)  // cache check (name)
        .mockResolvedValueOnce(null); // upsertCard check (id — new card)
      mockHttp.get.mockReturnValue(of({ data: scryfallCardFixture }));

      const result = await service.findByName('Lightning Bolt');

      expect(mockHttp.get).toHaveBeenCalledWith('/cards/named', { params: { fuzzy: 'Lightning Bolt' } });
      expect(mockEm.persist).toHaveBeenCalledWith(expect.any(Card));
      expect(mockEm.flush).toHaveBeenCalled();
      expect(result).toBeInstanceOf(Card);
      expect(result.name).toBe('Lightning Bolt');
    });

    it('should throw NotFoundException when the Scryfall API returns an error', async () => {
      mockEm.findOne.mockResolvedValueOnce(null);
      mockHttp.get.mockReturnValue(throwError(() => new Error('404')));

      await expect(service.findByName('Nonexistent Card')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findById', () => {
    it('should return a cached card without making an HTTP call', async () => {
      const cachedCard = new Card('scryfall-uuid-1', 'Lightning Bolt', 'https://scryfall.com', 1, 'Instant', 'common', 'lea', 'Alpha', ['R'], {});
      mockEm.findOne.mockResolvedValueOnce(cachedCard);

      const result = await service.findById('scryfall-uuid-1');

      expect(result).toBe(cachedCard);
      expect(mockHttp.get).not.toHaveBeenCalled();
    });

    it('should fetch from Scryfall /cards/:id when the card is not cached', async () => {
      mockEm.findOne
        .mockResolvedValueOnce(null)  // cache check
        .mockResolvedValueOnce(null); // upsertCard check
      mockHttp.get.mockReturnValue(of({ data: scryfallCardFixture }));

      const result = await service.findById('scryfall-uuid-1');

      expect(mockHttp.get).toHaveBeenCalledWith('/cards/scryfall-uuid-1');
      expect(result).toBeInstanceOf(Card);
    });

    it('should throw NotFoundException when the Scryfall API returns an error', async () => {
      mockEm.findOne.mockResolvedValueOnce(null);
      mockHttp.get.mockReturnValue(throwError(() => new Error('404')));

      await expect(service.findById('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('search', () => {
    it('should return an empty array when the Scryfall API returns an error', async () => {
      mockHttp.get.mockReturnValue(throwError(() => new Error('500')));

      const result = await service.search('xyzzy');

      expect(result).toEqual([]);
    });

    it('should return at most 20 cards from search results', async () => {
      const twentyOneCards = Array.from({ length: 21 }, (_, i) => ({
        ...scryfallCardFixture,
        id: `id-${i}`,
        name: `Card ${i}`,
      }));
      mockHttp.get.mockReturnValue(of({ data: { data: twentyOneCards } }));
      // upsertCard calls findOne once per card — return null (new cards) for all
      mockEm.findOne.mockResolvedValue(null);

      const result = await service.search('test');

      expect(result).toHaveLength(20);
    });

    it('should upsert each returned card', async () => {
      const twoCards = [
        { ...scryfallCardFixture, id: 'id-1', name: 'Card 1' },
        { ...scryfallCardFixture, id: 'id-2', name: 'Card 2' },
      ];
      mockHttp.get.mockReturnValue(of({ data: { data: twoCards } }));
      mockEm.findOne.mockResolvedValue(null);

      await service.search('test');

      // persist called once per card
      expect(mockEm.persist).toHaveBeenCalledTimes(2);
    });
  });

  describe('upsertCard', () => {
    it('should create a new Card entity when not in the database', async () => {
      mockEm.findOne
        .mockResolvedValueOnce(null)  // cache miss in findByName
        .mockResolvedValueOnce(null); // no existing card in upsertCard
      mockHttp.get.mockReturnValue(of({ data: scryfallCardFixture }));

      const result = await service.findByName('Lightning Bolt');

      expect(result).toBeInstanceOf(Card);
      expect(result.id).toBe('scryfall-uuid-1');
      expect(result.name).toBe('Lightning Bolt');
      expect(result.setCode).toBe('lea');
    });

    it('should update fields on an existing Card entity', async () => {
      const existingCard = new Card('scryfall-uuid-1', 'Old Name', 'old-uri', 0, 'Old Type', 'common', 'old', 'Old Set', [], {});
      mockEm.findOne
        .mockResolvedValueOnce(null)           // cache miss in findByName
        .mockResolvedValueOnce(existingCard);   // existing card in upsertCard
      mockHttp.get.mockReturnValue(of({ data: scryfallCardFixture }));

      const result = await service.findByName('Lightning Bolt');

      expect(result.name).toBe('Lightning Bolt');
      expect(result.scryfallUri).toBe(scryfallCardFixture.scryfall_uri);
      expect(result.rarity).toBe('common');
      expect(result.setName).toBe('Limited Edition Alpha');
    });

    it('should use the card_faces image when image_uris is absent (double-faced cards)', async () => {
      const doubleFacedFixture = {
        ...scryfallCardFixture,
        image_uris: undefined,
        card_faces: [{ image_uris: { normal: 'https://face-image.example.com/front.jpg' } }],
      };
      mockEm.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      mockHttp.get.mockReturnValue(of({ data: doubleFacedFixture }));

      const result = await service.findByName('Double-Faced Card');

      expect(result.imageUri).toBe('https://face-image.example.com/front.jpg');
    });

    it('should set isBasicLand=true when type_line contains "Basic Land"', async () => {
      const basicLandFixture = { ...scryfallCardFixture, type_line: 'Basic Land — Forest' };
      mockEm.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      mockHttp.get.mockReturnValue(of({ data: basicLandFixture }));

      const result = await service.findByName('Forest');

      expect(result.isBasicLand).toBe(true);
    });

    it('should set isBasicLand=false when type_line does not contain "Basic Land"', async () => {
      mockEm.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      mockHttp.get.mockReturnValue(of({ data: scryfallCardFixture }));

      const result = await service.findByName('Lightning Bolt');

      expect(result.isBasicLand).toBe(false);
    });
  });
});
