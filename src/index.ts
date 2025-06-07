import dotenv from 'dotenv';
import { botManager } from './bot/index.js';

/**
 * Main application entry point
 * Crossmint E-Commerce Agent - Telegram Bot
 */
async function main() {
  try {
    // Load environment variables
    dotenv.config();
    
    console.log('🎯 Crossmint E-Commerce Agent v1.0.0');
    console.log('📱 Platform: Telegram Bot');
    console.log('🤖 AI: GPT-4o via Vercel AI SDK');
    console.log('🛒 Commerce: Crossmint Integration (Coming Soon)');
    console.log('');

    // Validate required environment variables
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      throw new Error('❌ TELEGRAM_BOT_TOKEN is required. Please add it to your .env file.');
    }

    if (!process.env.OPENAI_API_KEY) {
      console.warn('⚠️  OPENAI_API_KEY not found. AI features will be limited until Task 2.2.');
    }

    // Start the bot
    await botManager.start();

  } catch (error) {
    console.error('🚨 Failed to start application:', error);
    process.exit(1);
  }
}

// Start the application
main().catch((error) => {
  console.error('🚨 Unhandled error in main:', error);
  process.exit(1);
}); 