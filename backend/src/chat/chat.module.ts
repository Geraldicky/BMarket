// src/chat/chat.module.ts

import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule], // Butuh JwtModule untuk verifikasi token di Gateway
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
})
export class ChatModule {}
