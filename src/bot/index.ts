import { telegramBot } from './platforms/telegram.js';
import { CommandHandlers } from './handlers/commands.js';
import { MessageHandlers } from './handlers/message.js';
import { botHttpServer } from './server.js';

/**
 * Main Bot Manager - Orchestrates all bot functionality
 */
export class BotManager {
  private isRunning = false;

  /**
   * Initialize and start the bot
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      console.log('🤖 Bot is already running');
      return;
    }

    try {
      console.log('🚀 Starting Crossmint E-Commerce Agent...');
      
      // Initialize Telegram bot
      await telegramBot.initialize();
      
      // Start HTTP server for webhooks
      await botHttpServer.start();
      
      // Set up all handlers
      CommandHandlers.init();
      MessageHandlers.init();
      
      // Set up graceful shutdown
      this.setupGracefulShutdown();
      
      this.isRunning = true;
      
      console.log('✅ Bot HTTP server is running!');
      console.log('🌐 HTTP server ready for web interface webhooks');
      console.log('🧪 Test webhooks at: http://localhost:3000/api/webhook/wallet-created');
      console.log('🔧 Use Ctrl+C to stop gracefully');

    } catch (error) {
      console.error('❌ Failed to start bot:', error);
      throw error;
    }
  }

  /**
   * Stop the bot gracefully
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log('🤖 Bot is not running');
      return;
    }

    console.log('🔄 Stopping bot...');
    
    try {
      await Promise.all([
        telegramBot.shutdown(),
        botHttpServer.stop()
      ]);
      this.isRunning = false;
      console.log('✅ Bot stopped successfully');
    } catch (error) {
      console.error('❌ Error stopping bot:', error);
      throw error;
    }
  }

  /**
   * Set up graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    const gracefulShutdown = async (signal: string) => {
      console.log(`\n🔄 Received ${signal}. Shutting down gracefully...`);
      
      try {
        await this.stop();
        process.exit(0);
      } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
      }
    };

    // Handle different shutdown signals
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // nodemon restart

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('🚨 Uncaught Exception:', error);
      gracefulShutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
      gracefulShutdown('unhandledRejection');
    });
  }

  /**
   * Get bot running status
   */
  public getStatus(): boolean {
    return this.isRunning;
  }
}

/**
 * Export singleton instance
 */
export const botManager = new BotManager(); 