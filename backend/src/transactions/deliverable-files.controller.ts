// src/transactions/deliverable-files.controller.ts

import { Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { TransactionsService } from './transactions.service';

// Public route on purpose: access is granted by the short-lived signed token that only the buyer
// or seller of the transaction can obtain (POST /transactions/:id/deliverables/:deliverableId/link).
@Controller('deliverable-files')
export class DeliverableFilesController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get(':token')
  async download(@Param('token') token: string, @Res() res: Response) {
    const { deliverable, buffer, mode, previewType } = await this.transactionsService.readDeliverableByToken(token);
    const asciiName = deliverable.fileName.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');
    const disposition = mode === 'preview' ? 'inline' : 'attachment';
    res.setHeader('Content-Type', previewType || deliverable.mimeType || 'application/octet-stream');
    res.setHeader('Content-Length', String(buffer.length));
    res.setHeader('Content-Disposition', `${disposition}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(deliverable.fileName)}`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (mode === 'preview') {
      // Previews never run scripts; object-src 'self' keeps the browser's built-in PDF viewer working.
      res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; object-src 'self'; frame-ancestors 'none'");
    }
    res.send(buffer);
  }
}
