import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ScanService } from './scan.service';
import { ScryfallService } from '../scryfall/scryfall.service';
import { InventoryService } from '../inventory/inventory.service';
import { Card } from '../entities/card.entity';
import { User } from '../entities/user.entity';
import { InventoryEntry } from '../entities/inventory-entry.entity';

jest.mock('tesseract.js', () => ({
  createWorker: jest.fn(),
}));

// Import after mock so we get the mocked version
import { createWorker } from 'tesseract.js';

const mockScryfall = {
  findByName: jest.fn(),
};

const mockInventory = {
  add: jest.fn(),
};

function makeCard(): Card {
  return Object.assign(
    new Card('card-1', 'Lightning Bolt', 'https://scryfall.com', 1, 'Instant', 'common', 'lea', 'Alpha', [], {}),
    { id: 'card-1' },
  );
}

function makeEntry(card: Card): InventoryEntry {
  const user = new User('test@example.com', 'hash');
  return Object.assign(new InventoryEntry(user, card, 1), { id: 'entry-1' });
}

describe('ScanService', () => {
  let service: ScanService;
  let mockWorker: { recognize: jest.Mock; terminate: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();

    mockWorker = {
      recognize: jest.fn().mockResolvedValue({ data: { text: 'Lightning Bolt\nInstant\nDeals 3 damage.' } }),
      terminate: jest.fn().mockResolvedValue(undefined),
    };
    (createWorker as jest.Mock).mockResolvedValue(mockWorker);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScanService,
        { provide: ScryfallService, useValue: mockScryfall },
        { provide: InventoryService, useValue: mockInventory },
      ],
    }).compile();

    service = module.get(ScanService);
  });

  describe('scanImage', () => {
    it('should return cardName, card, and inventoryEntry on success', async () => {
      const card = makeCard();
      const entry = makeEntry(card);
      mockScryfall.findByName.mockResolvedValueOnce(card);
      mockInventory.add.mockResolvedValueOnce(entry);

      const result = await service.scanImage(Buffer.from('fake-image'), 'user-1');

      expect(result).toEqual({ cardName: 'Lightning Bolt', card, inventoryEntry: entry });
    });

    it('should call scryfall.findByName with the first OCR line longer than 2 chars', async () => {
      const card = makeCard();
      mockScryfall.findByName.mockResolvedValueOnce(card);
      mockInventory.add.mockResolvedValueOnce(makeEntry(card));
      // OCR output has short lines before the card name
      mockWorker.recognize.mockResolvedValueOnce({ data: { text: 'AB\n\nLightning Bolt\nInstant' } });

      await service.scanImage(Buffer.from('fake-image'), 'user-1');

      expect(mockScryfall.findByName).toHaveBeenCalledWith('Lightning Bolt');
    });

    it('should call inventory.add with the correct userId and card id', async () => {
      const card = makeCard();
      mockScryfall.findByName.mockResolvedValueOnce(card);
      mockInventory.add.mockResolvedValueOnce(makeEntry(card));

      await service.scanImage(Buffer.from('fake-image'), 'user-1');

      expect(mockInventory.add).toHaveBeenCalledWith('user-1', 'card-1', 1);
    });

    it('should always call worker.terminate even when recognize throws', async () => {
      mockWorker.recognize.mockRejectedValueOnce(new Error('OCR engine failure'));

      await expect(service.scanImage(Buffer.from('fake-image'), 'user-1')).rejects.toThrow('OCR engine failure');
      expect(mockWorker.terminate).toHaveBeenCalledTimes(1);
    });

    it('should throw BadRequestException when OCR text is empty', async () => {
      mockWorker.recognize.mockResolvedValueOnce({ data: { text: '' } });

      await expect(service.scanImage(Buffer.from('fake-image'), 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when all OCR lines are 2 chars or fewer', async () => {
      mockWorker.recognize.mockResolvedValueOnce({ data: { text: 'AB\nXY\n\nZ\n' } });

      await expect(service.scanImage(Buffer.from('fake-image'), 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('should propagate errors from scryfall.findByName', async () => {
      mockScryfall.findByName.mockRejectedValueOnce(new Error('Card not found on Scryfall'));

      await expect(service.scanImage(Buffer.from('fake-image'), 'user-1')).rejects.toThrow('Card not found on Scryfall');
    });
  });
});
