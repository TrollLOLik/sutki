import { runtimeConfig } from '@shared/config/runtime';
import type { ChatRepository } from './chatRepository';
import { HttpChatRepository } from './httpChatRepository';
import { MockChatRepository } from './mockChatRepository';

export const CHAT_DATA_MODE = runtimeConfig.chatDataMode;
export const chatRepository: ChatRepository = CHAT_DATA_MODE === 'http'
  ? new HttpChatRepository()
  : new MockChatRepository();
