import { z } from 'zod';
import dotenv from 'dotenv';
import type { BotConfig } from '../types/index.js';

// Load environment variables
dotenv.config();

/**
 * Environment variables schema validation using Zod
 */
const envSchema = z.object({
  // Telegram Configuration
  TELEGRAM_BOT_TOKEN: z.string().min(1, 'Telegram bot token is required'),
  TELEGRAM_WEBHOOK_URL: z.string().optional().refine(
    (val) => !val || val === '' || z.string().url().safeParse(val).success,
    { message: 'Must be empty or a valid URL' }
  ),

  // OpenAI Configuration  
  OPENAI_API_KEY: z.string().min(1, 'OpenAI API key is required'),

  // Bot Signer Configuration
  BOT_SIGNER_PRIVATE_KEY: z.string().optional(),

  // Web Application Configuration
  WEB_APP_URL: z.string().url().optional(),

  // Application Configuration
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  PORT: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().int().min(1).max(65535)).default('3000'),
  MAX_CONVERSATION_HISTORY: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().int().min(1).max(100)).default('20'),
  RATE_LIMIT_MESSAGES_PER_MINUTE: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().int().min(1).max(100)).default('10'),
  
  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

/**
 * Validate and parse environment variables
 */
function validateEnv() {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    console.error('❌ Environment validation failed:');
    if (error instanceof z.ZodError) {
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
    }
    process.exit(1);
  }
}

// Validate environment variables on module load
const env = validateEnv();

/**
 * Application configuration object
 */
export const config: BotConfig = {
  telegram: {
    token: env.TELEGRAM_BOT_TOKEN,
    ...(env.TELEGRAM_WEBHOOK_URL && { webhookUrl: env.TELEGRAM_WEBHOOK_URL }),
  },
  openai: {
    apiKey: env.OPENAI_API_KEY,
    model: 'gpt-4o', // Primary model from our tech stack
  },
  bot: {
    signerPrivateKey: env.BOT_SIGNER_PRIVATE_KEY,
  },
  webApp: {
    url: env.WEB_APP_URL || 'https://your-app.vercel.app',
  },
  app: {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    maxConversationHistory: env.MAX_CONVERSATION_HISTORY,
    rateLimitMessagesPerMinute: env.RATE_LIMIT_MESSAGES_PER_MINUTE,
    logLevel: env.LOG_LEVEL,
  },
};

/**
 * Helper function to check if we're in development mode
 */
export const isDevelopment = () => config.app.nodeEnv === 'development';

/**
 * Helper function to check if we're in production mode
 */
export const isProduction = () => config.app.nodeEnv === 'production'; 