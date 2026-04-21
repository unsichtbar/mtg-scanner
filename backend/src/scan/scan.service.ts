import { BadRequestException, Injectable } from '@nestjs/common';
import { createWorker } from 'tesseract.js';
import { ScryfallService } from '../scryfall/scryfall.service';
import { InventoryService } from '../inventory/inventory.service';

@Injectable()
export class ScanService {
  constructor(
    private readonly scryfall: ScryfallService,
    private readonly inventory: InventoryService,
  ) {}

  async scanImage(imageBuffer: Buffer, userId: string) {
    const worker = await createWorker('eng');
    let text: string;
    try {
      const { data } = await worker.recognize(imageBuffer);
      text = data.text;
    } finally {
      await worker.terminate();
    }

    const cardName = this.extractCardName(text);
    if (!cardName) {
      throw new BadRequestException('Could not extract a card name from the image');
    }

    const card = await this.scryfall.findByName(cardName);
    const inventoryEntry = await this.inventory.add(userId, card.id, 1);

    return { cardName, card, inventoryEntry };
  }

  // Card name is typically the first non-empty line of OCR output
  private extractCardName(text: string): string | null {
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 2);

    return lines[0] ?? null;
  }
}
