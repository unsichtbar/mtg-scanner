import { Module } from '@nestjs/common';
import { ScanService } from './scan.service';
import { ScanController } from './scan.controller';
import { ScryfallModule } from '../scryfall/scryfall.module';

@Module({
  imports: [ScryfallModule],
  providers: [ScanService],
  controllers: [ScanController],
})
export class ScanModule {}
