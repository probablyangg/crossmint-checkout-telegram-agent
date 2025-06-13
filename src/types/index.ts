/**
 * Core type definitions for Telegram AI Bot
 */

export interface BotConfig {
  telegram: {
    token: string;
    webhookUrl?: string;
  };
  openai: {
    apiKey: string;
    model: string;
  };
  bot: {
    signerPrivateKey?: string | undefined;
  };
  webApp: {
    url: string;
  };
  app: {
    nodeEnv: 'development' | 'production';
    port: number;
    maxConversationHistory: number;
    rateLimitMessagesPerMinute: number;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
  };
}

// export interface ConversationMessage {
//   role: 'user' | 'assistant';
//   content: string;
//   timestamp: Date;
// }

// export interface UserConversation {
//   userId: number;
//   messages: ConversationMessage[];
//   lastActivity: Date;
// }

// export interface BotResponse {
//   text: string;
//   success: boolean;
//   error?: string;
// }

// export interface RateLimitInfo {
//   userId: number;
//   messageCount: number;
//   windowStart: Date;
// } 