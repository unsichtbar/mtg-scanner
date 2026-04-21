import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ScryfallService } from '../scryfall/scryfall.service';

@UseGuards(JwtAuthGuard)
@Controller('cards')
export class CardsController {
  constructor(private readonly scryfall: ScryfallService) {}

  @Get('search')
  search(@Query('q') q: string) {
    if (!q?.trim()) return [];
    return this.scryfall.search(q.trim());
  }
}
