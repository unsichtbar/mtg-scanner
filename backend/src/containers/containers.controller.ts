import {
  Body, Controller, Delete, Get, HttpCode,
  Param, Patch, Post, Request, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ContainersService } from './containers.service';

@UseGuards(JwtAuthGuard)
@Controller('containers')
export class ContainersController {
  constructor(private readonly containers: ContainersService) {}

  @Get()
  list(@Request() req) {
    return this.containers.list(req.user.id);
  }

  @Post()
  create(@Request() req, @Body() body: { name: string }) {
    return this.containers.create(req.user.id, body.name);
  }

  @Get(':id')
  get(@Request() req, @Param('id') id: string) {
    return this.containers.get(req.user.id, id);
  }

  @Patch(':id')
  rename(@Request() req, @Param('id') id: string, @Body() body: { name: string }) {
    return this.containers.rename(req.user.id, id, body.name);
  }

  @Delete(':id')
  @HttpCode(204)
  delete(@Request() req, @Param('id') id: string) {
    return this.containers.delete(req.user.id, id);
  }

  @Post(':id/cards')
  addCard(
    @Request() req,
    @Param('id') containerId: string,
    @Body() body: { cardId: string; quantity?: number },
  ) {
    return this.containers.addCard(req.user.id, containerId, body.cardId, body.quantity ?? 1);
  }

  @Patch(':id/cards/:cardId')
  setCardQuantity(
    @Request() req,
    @Param('id') containerId: string,
    @Param('cardId') cardId: string,
    @Body() body: { quantity: number },
  ) {
    return this.containers.setCardQuantity(req.user.id, containerId, cardId, body.quantity);
  }

  @Delete(':id/cards/:cardId')
  @HttpCode(204)
  removeCard(
    @Request() req,
    @Param('id') containerId: string,
    @Param('cardId') cardId: string,
  ) {
    return this.containers.removeCard(req.user.id, containerId, cardId);
  }
}
