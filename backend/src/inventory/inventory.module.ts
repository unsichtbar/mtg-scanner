import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { ScryfallModule } from '../scryfall/scryfall.module';
import { InventoryEntry } from '../entities/inventory-entry.entity';
import { User } from '../entities/user.entity';

@Module({
  imports: [ScryfallModule, MikroOrmModule.forFeature([InventoryEntry, User])],
  providers: [InventoryService],
  controllers: [InventoryController],
})
export class InventoryModule {}
