import { Module } from '@nestjs/common';
import { ScanService } from './scan.service';
import { ScanController } from './scan.controller';
import { ScryfallModule } from '../scryfall/scryfall.module';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [ScryfallModule, InventoryModule],
  providers: [ScanService],
  controllers: [ScanController],
})
export class ScanModule {}
