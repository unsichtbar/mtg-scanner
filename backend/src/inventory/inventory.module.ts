import { Module } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { CardsController } from './cards.controller';
import { ScryfallModule } from '../scryfall/scryfall.module';

@Module({
  imports: [ScryfallModule],
  providers: [InventoryService],
  controllers: [InventoryController, CardsController],
  exports: [InventoryService],
})
export class InventoryModule {}
