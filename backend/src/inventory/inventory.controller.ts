import {
  Body, Controller, Delete, Get, HttpCode,
  Param, Patch, Post, Query, Request, Res, UseGuards, UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { type Response } from 'express';
import { memoryStorage } from 'multer';
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

  @Get('export')
  async exportCsv(@Request() req, @Res() res: Response) {
    const csv = await this.inventory.exportCsv(req.user.id);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="inventory.csv"');
    res.send(csv);
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  importCsv(@Request() req, @UploadedFile() file: Express.Multer.File) {
    const csv = file.buffer.toString('utf-8');
    return this.inventory.importCsv(req.user.id, csv);
  }

  @Get('export/versioned')
  async exportVersionedCsv(@Request() req, @Res() res: Response) {
    const csv = await this.inventory.exportVersionedCsv(req.user.id);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="inventory-versioned.csv"');
    res.send(csv);
  }

  @Post('import/versioned')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  importVersionedCsv(@Request() req, @UploadedFile() file: Express.Multer.File) {
    const csv = file.buffer.toString('utf-8');
    return this.inventory.importVersionedCsv(req.user.id, csv);
  }
}
