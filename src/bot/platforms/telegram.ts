import TelegramBot from 'node-telegram-bot-api';
import { config, isDevelopment } from '../../utils/config.js';

/**
 * Telegram Bot Setup and Management
 */
export class TelegramBotManager {
  private bot: TelegramBot;
  private isInitialized = false;

  constructor() {
    // Initialize bot with polling for development, webhook for production
    this.bot = new TelegramBot(config.telegram.token, {
      polling: isDevelopment(), // Use polling in development
      filepath: false, // Don't download files automatically
    });

    this.setupErrorHandling();
  }

  /**
   * Initialize the bot and set up handlers
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('📱 Telegram bot already initialized');
      return;
    }

    try {
      console.log('🔄 Testing Telegram bot connection...');
      
      // Test bot connection
      const botInfo = await this.bot.getMe();

      console.log(`🤖 Telegram bot initialized: @${botInfo.username}`);
      console.log(`📊 Bot ID: ${botInfo.id}`);
      console.log(`🔧 Mode: ${isDevelopment() ? 'Development (Polling)' : 'Production (Webhook)'}`);

      this.isInitialized = true;
    } catch (error) {
      console.error('❌ Failed to initialize Telegram bot:', error);
      throw error;
    }
  }

  /**
   * Set up error handling for the bot
   */
  private setupErrorHandling(): void {
    this.bot.on('error', (error) => {
      console.error('🚨 Telegram Bot Error:', error);
    });

    this.bot.on('polling_error', (error) => {
      console.error('🚨 Telegram Polling Error:', error);
    });

    // Handle webhook errors in production
    if (!isDevelopment()) {
      this.bot.on('webhook_error', (error) => {
        console.error('🚨 Telegram Webhook Error:', error);
      });
    }
  }

  /**
   * Register a text message handler
   */
  public onText(regex: RegExp, callback: (msg: TelegramBot.Message, match: RegExpExecArray | null) => Promise<void>): void {
    this.bot.onText(regex, async (msg, match) => {
      try {
        await callback(msg, match);
      } catch (error) {
        console.error('❌ Error handling text message:', error);
        await this.sendErrorMessage(msg.chat.id, 'Sorry, something went wrong. Please try again.');
      }
    });
  }

  /**
   * Register a general message handler
   */
  public onMessage(callback: (msg: TelegramBot.Message) => Promise<void>): void {
    this.bot.on('message', async (msg) => {
      try {
        // Skip if message has been handled by onText handlers
        if (msg.text && msg.text.startsWith('/')) {
          return; // Let command handlers deal with it
        }
        await callback(msg);
      } catch (error) {
        console.error('❌ Error handling message:', error);
        await this.sendErrorMessage(msg.chat.id, 'Sorry, something went wrong. Please try again.');
      }
    });
  }

  /**
   * Send a text message
   */
  public async sendMessage(chatId: number, text: string, options?: TelegramBot.SendMessageOptions): Promise<TelegramBot.Message> {
    try {
      return await this.bot.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
        ...options,
      });
    } catch (error) {
      console.error('❌ Error sending message:', error);
      throw error;
    }
  }

  /**
   * Send an error message to user
   */
  private async sendErrorMessage(chatId: number, message: string): Promise<void> {
    try {
      await this.bot.sendMessage(chatId, `❌ ${message}`);
    } catch (error) {
      console.error('❌ Failed to send error message:', error);
    }
  }

  /**
   * Send a typing indicator
   */
  public async sendTyping(chatId: number): Promise<void> {
    try {
      await this.bot.sendChatAction(chatId, 'typing');
    } catch (error) {
      console.error('❌ Error sending typing indicator:', error);
    }
  }

  /**
   * Get bot instance (for advanced usage)
   */
  public getBotInstance(): TelegramBot {
    return this.bot;
  }

  /**
   * Graceful shutdown
   */
  public async shutdown(): Promise<void> {
    console.log('🔄 Shutting down Telegram bot...');
    try {
      await this.bot.stopPolling();
      console.log('✅ Telegram bot shutdown complete');
    } catch (error) {
      console.error('❌ Error during bot shutdown:', error);
    }
  }
}

/**
 * Singleton instance for the bot manager
 */
export const telegramBot = new TelegramBotManager(); 