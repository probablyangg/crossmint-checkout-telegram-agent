import type TelegramBot from 'node-telegram-bot-api';
import { telegramBot } from '../platforms/telegram.js';
import { handleCheckoutMessage } from './checkoutHandler.js';
import { addMessage, getConversationHistory } from '../../utils/memory.js';

/**
 * Message handlers for general conversation
 * This will integrate with AI SDK for intelligent responses
 */
export class MessageHandlers {
  /**
   * Initialize message handlers
   */
  public static init(): void {
    console.log('🔧 Setting up message handlers...');
    
    this.setupGeneralMessageHandler();
    
    console.log('✅ Message handlers initialized');
  }

  /**
   * Handle general messages (non-commands)
   */
  private static setupGeneralMessageHandler(): void {
    telegramBot.onMessage(async (msg: TelegramBot.Message) => {
      const chatId = msg.chat.id;
      const messageText = msg.text;
      const userName = msg.from?.first_name || 'User';

      // Skip if no text or if it's a command
      if (!messageText || messageText.startsWith('/')) {
        return;
      }

      console.log(`💬 Message from ${userName}: ${messageText}`);

      try {
        // Store user message in memory
        const userId = msg.from?.id;
        if (userId) {
          const userInfo: { username?: string; firstName?: string } = {};
          if (msg.from?.username) userInfo.username = msg.from.username;
          if (msg.from?.first_name) userInfo.firstName = msg.from.first_name;
          
          addMessage(userId, 'user', messageText, 'text', userInfo);
        }

        // Check if user is in checkout flow first
        const isCheckoutMessage = await handleCheckoutMessage(telegramBot.getBotInstance(), msg);
        if (isCheckoutMessage) {
          return; // Message was handled by checkout flow
        }

        // Send typing indicator
        await telegramBot.sendTyping(chatId);

        // Generate response with memory context
        const response = await this.generateContextualResponse(messageText, userName, userId);
        
        // Store assistant response in memory
        if (userId) {
          addMessage(userId, 'assistant', response, 'text');
        }
        
        await telegramBot.sendMessage(chatId, response);

      } catch (error) {
        console.error('❌ Error handling message:', error);
        await telegramBot.sendMessage(
          chatId, 
          '❌ Sorry, I encountered an error. Please try again or use /help for assistance.'
        );
      }
    });
  }

  /**
   * Generate a contextual response using memory
   */
  private static async generateContextualResponse(message: string, userName: string, userId?: number): Promise<string> {
    // Get conversation context from memory
    if (userId) {
      const history = getConversationHistory(userId);
      
      // Check if user has mentioned things before
      if (history.length > 1) {
        const previousUserMessages = history
          .filter(msg => msg.role === 'user')
          .map(msg => msg.content);
        
        // Simple memory-based responses
        if (previousUserMessages.some(msg => msg.toLowerCase().includes('search'))) {
          if (message.toLowerCase().includes('what') || message.toLowerCase().includes('find')) {
            return `I remember you were interested in searching for products! 🔍 You can use /search [product name] to find Amazon products. What would you like to search for?`;
          }
        }
      }
    }
    
    return await this.generateSimpleResponse(message, userName);
  }

  /**
   * Generate a simple response (placeholder for AI SDK integration)
   * This will be replaced with proper AI generation in Task 2.2
   */
  private static async generateSimpleResponse(message: string, userName: string): Promise<string> {
    // Simple keyword-based responses for testing
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
      return `Hello ${userName}! 👋 Great to chat with you! I'm your Crossmint shopping assistant. What can I help you with today?`;
    }

    if (lowerMessage.includes('help')) {
      return `I'm here to help! 🤖 Try using /help to see all available commands, or just ask me anything you'd like to know!`;
    }

    if (lowerMessage.includes('shop') || lowerMessage.includes('buy') || lowerMessage.includes('purchase')) {
      return `🛒 Shopping features are coming soon! In the next update, I'll be able to help you:\n• Search Amazon products\n• Check your wallet balance\n• Make secure purchases\n\nFor now, feel free to chat with me about anything! 😊`;
    }

    if (lowerMessage.includes('crossmint')) {
      return `🌟 Crossmint is an amazing platform for Web3 commerce! I'll be integrated with Crossmint's checkout and wallet systems to make shopping super easy. What would you like to know about it?`;
    }

    if (lowerMessage.includes('how are you') || lowerMessage.includes('how do you do')) {
      return `I'm doing great, thank you for asking! 😊 I'm excited to be your shopping assistant. I'm currently in my early stage but I'll soon be able to help you with product searches and purchases. How are you doing today?`;
    }

    // Default response
    return `Thanks for your message, ${userName}! 💬 

I'm a conversational AI shopping assistant. Right now I'm in my foundation stage, but I can chat about various topics! 

🔮 **Coming Soon:** AI-powered responses with GPT-4o integration for more natural conversations.

🛒 **Also Coming:** Shopping features with Crossmint integration!

What would you like to talk about? Or try /help to see what I can do! 🚀`;
  }

  // Future AI SDK integration will be implemented in Task 2.2:
  // - Conversation history management
  // - Context-aware responses with GPT-4o  
  // - Multi-step reasoning (maxSteps)
  // - Brief, helpful responses optimized for chat
}

export async function handleMessage(bot: TelegramBot, msg: TelegramBot.Message): Promise<void> {
  try {
    const text = msg.text;
    const userId = msg.from?.id;

    // Skip if no text or user ID
    if (!text || !userId) {
      return;
    }

    console.log(`💬 Message from user ${userId}: ${text}`);

    // Check if user is in checkout flow first
    const isCheckoutMessage = await handleCheckoutMessage(bot, msg);
    if (isCheckoutMessage) {
      return; // Message was handled by checkout flow
    }

    // Continue with normal message processing...
    // ... existing message handling code ...
  } catch (error) {
    console.error('❌ Error handling message:', error);
    await bot.sendMessage(
      msg.chat.id, 
      '❌ Sorry, I encountered an error. Please try again or use /help for assistance.'
    );
  }
} 