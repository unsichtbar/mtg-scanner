import { BadRequestException, Injectable } from '@nestjs/common';
import { createWorker } from 'tesseract.js';
import { ScryfallService } from '../scryfall/scryfall.service';

@Injectable()
export class ScanService {
  constructor(private readonly scryfall: ScryfallService) {}

  async scanImage(imageBuffer: Buffer) {
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
    return { cardName, card };
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
