import {
  BadRequestException, Controller, Post, Query, Request,
  UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ScanService } from './scan.service';

@UseGuards(JwtAuthGuard)
@Controller('scan')
export class ScanController {
  constructor(private readonly scan: ScanService) {}

  @Post()
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: 10 * 1024 * 1024 } }))
  scanCard(
    @Request() req,
    @UploadedFile() file: Express.Multer.File,
    @Query('containerId') containerId?: string,
  ) {
    if (!file) throw new BadRequestException('No image provided');
    return this.scan.scanImage(file.buffer, req.user.id, containerId);
  }
}
