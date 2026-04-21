import {
  Body, Controller, Delete, Get, HttpCode,
  Param, Patch, Post, Request, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DecksService } from './decks.service';
import { GameFormat } from '../entities/deck.entity';

@UseGuards(JwtAuthGuard)
@Controller('decks')
export class DecksController {
  constructor(private readonly decks: DecksService) {}

  @Get()
  list(@Request() req) {
    return this.decks.list(req.user.id);
  }

  @Post()
  create(@Request() req, @Body() body: { name: string; format: GameFormat }) {
    return this.decks.create(req.user.id, body.name, body.format);
  }

  @Get(':id')
  get(@Request() req, @Param('id') id: string) {
    return this.decks.get(req.user.id, id);
  }

  @Delete(':id')
  @HttpCode(204)
  delete(@Request() req, @Param('id') id: string) {
    return this.decks.delete(req.user.id, id);
  }

  @Post(':id/cards')
  addCard(
    @Request() req,
    @Param('id') deckId: string,
    @Body() body: { cardId: string; quantity?: number },
  ) {
    return this.decks.addCard(req.user.id, deckId, body.cardId, body.quantity ?? 1);
  }

  @Patch(':id/cards/:cardId')
  setCardQuantity(
    @Request() req,
    @Param('id') deckId: string,
    @Param('cardId') cardId: string,
    @Body() body: { quantity: number },
  ) {
    return this.decks.setCardQuantity(req.user.id, deckId, cardId, body.quantity);
  }

  @Delete(':id/cards/:cardId')
  @HttpCode(204)
  removeCard(
    @Request() req,
    @Param('id') deckId: string,
    @Param('cardId') cardId: string,
  ) {
    return this.decks.removeCard(req.user.id, deckId, cardId);
  }

  @Get(':id/validate')
  validate(@Request() req, @Param('id') id: string) {
    return this.decks.validate(req.user.id, id);
  }
}
