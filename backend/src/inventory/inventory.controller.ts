import {
  Body, Controller, Delete, Get, HttpCode,
  Param, Patch, Post, Query, Request, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InventoryService } from './inventory.service';

@UseGuards(JwtAuthGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get()
  list(
    @Request() req,
    @Query('name') name?: string,
    @Query('colors') colors?: string,
    @Query('manaCost') manaCost?: string,
    @Query('text') text?: string,
    @Query('type') type?: string,
    @Query('rarity') rarity?: string,
  ): Promise<any[]> {
    return this.inventory.list(req.user.id, {
      name,
      colors: colors ? colors.split(',') : undefined,
      manaCost,
      text,
      type,
      rarity,
    });
  }

  @Post()
  add(@Request() req, @Body() body: { cardId: string; quantity?: number }) {
    return this.inventory.add(req.user.id, body.cardId, body.quantity ?? 1);
  }

  @Patch(':id')
  update(@Request() req, @Param('id') id: string, @Body() body: { quantity: number }) {
    return this.inventory.update(req.user.id, id, body.quantity);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Request() req, @Param('id') id: string) {
    return this.inventory.remove(req.user.id, id);
  }
}
