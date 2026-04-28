import { Module } from '@nestjs/common';
import { ContainersService } from './containers.service';
import { ContainersController } from './containers.controller';
import { ScryfallModule } from '../scryfall/scryfall.module';

@Module({
  imports: [ScryfallModule],
  providers: [ContainersService],
  controllers: [ContainersController],
  exports: [ContainersService],
})
export class ContainersModule {}
