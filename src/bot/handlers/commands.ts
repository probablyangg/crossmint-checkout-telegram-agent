import TelegramBot from 'node-telegram-bot-api';
import { telegramBot } from '../platforms/telegram.js';
import { handleSearchCommand, handleSearchCallback, handleAutoSearchCallback } from './searchHandler.js';
import { handleCrossmintBuy, handleCheckoutCancel } from './checkoutHandler.js';
import * as memoryUtils from '../../utils/memory.js';
import { crossmintWalletService } from '../../commerce/crossmint/wallet.js';
import { config } from '../../utils/config.js';
import { escapeMarkdown } from '../../commerce/search/formatting.js';

/**
 * Command handlers for the Telegram bot
 */
export class CommandHandlers {
  /**
   * Helper to generate login URL
   */
  private static getLoginUrl(userId: number): string {
    const state = Buffer.from(JSON.stringify({ userId })).toString('base64');
    return `${config.webApp.url}/?state=${state}`;
  }

  /**
   * Helper to generate delegation URL
   */
  private static getDelegationUrl(userId: number): string {
    return `${config.webApp.url}/delegate?userId=${userId}`;
  }

  /**
   * Initialize all command handlers
   */
  public static init(): void {
    console.log('🔧 Setting up bot command handlers...');
    
    this.setupStartCommand();
    this.setupHelpCommand();
    this.setupAboutCommand();
    this.setupSearchCommand();
    this.setupMemoryCommands();
    this.setupWalletCommands();
    this.setupDelegationCommands();
    this.setupCallbackHandlers();
    
    // Future commerce commands will be added here:
    // this.setupBalanceCommand();
    // this.setupBuyCommand();
    
    console.log('✅ Command handlers initialized');
  }

  /**
   * Handle /start command
   */
  private static setupStartCommand(): void {
    telegramBot.onText(/\/start/, async (msg: TelegramBot.Message) => {
      const chatId = msg.chat.id;
      const userName = msg.from?.first_name || 'there';
      
      await telegramBot.sendTyping(chatId);
      
      const welcomeMessage = `
🤖 *Welcome to Crossmint E-Commerce Agent!*

Hello ${userName}! 👋

I'm your AI-powered shopping assistant. I can help you with:

💬 *Current Features:*
• Chat about anything 
• Get helpful information
• Answer your questions

🛒 *Coming Soon:*
• Browse Amazon products
• Check your wallet balance  
• Make secure purchases
• Track your orders

🚀 *Get Started:*
• Just type any message to chat with me
• Use /help to see available commands
• Use /about to learn more about me

*What would you like to talk about today?*
      `;

      await telegramBot.sendMessage(chatId, welcomeMessage.trim());
    });
  }

  /**
   * Handle /help command
   */
  private static setupHelpCommand(): void {
    telegramBot.onText(/\/help/, async (msg: TelegramBot.Message) => {
      const chatId = msg.chat.id;
      
      await telegramBot.sendTyping(chatId);
      
      const helpMessage = `
📖 *Available Commands:*

🔤 *Basic Commands:*
• /start - Welcome message and introduction
• /help - Show this help message  
• /about - Learn more about this bot

🛒 *Shopping Commands:*
• /search [item] - Search for Amazon products
• Products show "Buy with Crossmint" buttons

💰 *Wallet Commands:*
• /login - Create/connect your Crossmint wallet
• /balance - Check your wallet balance
• /topup - Add funds to your wallet
• /delegate - Enable fast shopping (auto-sign transactions)
• /logout - Sign out and clear session data

🧠 *Memory Commands:*
• /memory - See what I remember about you
• /forget - Clear conversation history

💬 *Chat Features:*
• Send me any message and I'll respond with helpful information
• I remember our conversations and your preferences
• Ask questions about any topic

🤖 *AI Features:*
• Powered by GPT-4o for intelligent responses
• Context-aware conversations
• Multi-step reasoning for complex queries

*Just start chatting - I'm here to help!* 😊
      `;

      await telegramBot.sendMessage(chatId, helpMessage.trim());
    });
  }

  /**
   * Handle /about command
   */
  private static setupAboutCommand(): void {
    telegramBot.onText(/\/about/, async (msg: TelegramBot.Message) => {
      const chatId = msg.chat.id;
      
      await telegramBot.sendTyping(chatId);
      
      const aboutMessage = `
🤖 *About Crossmint E-Commerce Agent*

*What I Am:*
• AI-powered shopping assistant
• Built with Vercel AI SDK & OpenAI GPT-4o
• Designed for seamless e-commerce experiences

*My Mission:*
• Make online shopping conversational and easy
• Provide instant product search and recommendations  
• Enable secure purchases through Crossmint integration
• Support both Telegram and WhatsApp platforms

*Technology Stack:*
• 🧠 AI: Vercel AI SDK with GPT-4o
• 💬 Platform: Telegram Bot API
• 🛒 Commerce: Crossmint Checkout & Wallets
• 🔍 Search: Google Search API for products
• 💾 Backend: Node.js + TypeScript

*Developer Info:*
• Open source and easily deployable
• Modular architecture for customization
• Built for developers to clone and extend
• Comprehensive setup documentation

*Version:* 1.0.0 (MVP - Chat Foundation)
*Next Update:* Commerce features with Crossmint integration

🌟 *Ready to revolutionize shopping with AI!*

Want to chat? Just send me any message! 💬
      `;

      await telegramBot.sendMessage(chatId, aboutMessage.trim());
    });
  }

  /**
   * Handle search-related commands
   */
  private static setupSearchCommand(): void {
    // /search command
    telegramBot.onText(/\/search(.*)/, async (msg: TelegramBot.Message) => {
      await handleSearchCommand(telegramBot.getBotInstance(), msg);
    });
  }

  /**
   * Handle memory-related commands
   */
  private static setupMemoryCommands(): void {
    // /memory - Show what the bot remembers about the user
    telegramBot.onText(/\/memory/, async (msg: TelegramBot.Message) => {
      const chatId = msg.chat.id;
      const userId = msg.from?.id;
      
      if (!userId) {
        await telegramBot.sendMessage(chatId, '❌ Unable to access user information.');
        return;
      }

      const memory = memoryUtils.getUserMemory(userId);
      
      if (!memory || memory.messages.length === 0) {
        await telegramBot.sendMessage(chatId, 
          '🧠 *Memory Status*\n\n' +
          'I don\'t have any memories of our conversations yet\\. Start chatting with me to build our conversation history\\!',
          { parse_mode: 'MarkdownV2' }
        );
        return;
      }

      const recentCount = Math.min(memory.messages.length, 5);
      let message = `🧠 *What I Remember About You*\n\n`;
      
      if (memory.firstName) {
        message += `*Name:* ${memory.firstName}\n`;
      }
      if (memory.username) {
        message += `*Username:* @${memory.username}\n`;
      }
      
      message += `*Total Messages:* ${memory.messages.length}\n`;
      
      if (memory.preferences?.lastSearchQuery) {
        message += `*Last Search:* ${memory.preferences.lastSearchQuery}\n`;
      }
      
      message += `\n*Recent Messages \\(${recentCount}\\):*\n`;
             memory.messages.slice(-recentCount).forEach((msg) => {
        const role = msg.role === 'user' ? '👤' : '🤖';
        const content = msg.content.length > 50 ? msg.content.substring(0, 50) + '...' : msg.content;
        message += `${role} ${content.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\n`;
      });

      await telegramBot.sendMessage(chatId, message, { parse_mode: 'MarkdownV2' });
    });

    // /forget - Clear user's memory
    telegramBot.onText(/\/forget/, async (msg: TelegramBot.Message) => {
      const chatId = msg.chat.id;
      const userId = msg.from?.id;
      
      if (!userId) {
        await telegramBot.sendMessage(chatId, '❌ Unable to access user information.');
        return;
      }

      memoryUtils.clearUserMemory(userId);
      await telegramBot.sendMessage(chatId, 
        '🗑️ *Memory Cleared*\n\n' +
        'I\'ve forgotten our previous conversations\\. We can start fresh\\!',
        { parse_mode: 'MarkdownV2' }
      );
    });
  }

  /**
   * Handle wallet-related commands
   */
  private static setupWalletCommands(): void {
    // Helper for "login needed" message
    const needsLoginMessage = (chatId: number, text: string) => {
      telegramBot.sendMessage(chatId, text, {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Click here to Log In', callback_data: 'login_prompt' }]
          ]
        }
      });
    };
    
    // /login command
    telegramBot.onText(/\/login/, async (msg: TelegramBot.Message) => {
      const chatId = msg.chat.id;
      const userId = msg.from?.id;

      if (!userId) {
        await telegramBot.sendMessage(chatId, 'Could not get user ID.');
        return;
      }

      await telegramBot.sendTyping(chatId);
      
      try {
        const user = crossmintWalletService.getUser(userId);
        if (user && user.walletAddress) {
          const address = user.walletAddress;
          const message = `✅ You are already logged in\\!\n\nYour wallet address is:\n\`${escapeMarkdown(address)}\`\n\nYou can check your /balance or start shopping\\.`;
          await telegramBot.sendMessage(chatId, message, { parse_mode: 'MarkdownV2' });
        } else {
          const url = this.getLoginUrl(userId);
          await telegramBot.sendMessage(chatId, 'Please log in to your Crossmint wallet.', {
            reply_markup: {
              inline_keyboard: [[{ text: 'Log in to Crossmint', url }]]
            }
          });
        }
      } catch (error) {
        console.error('Error during /login:', error);
        await telegramBot.sendMessage(chatId, 'An error occurred. Please try again later.');
      }
    });

    // /balance command
    telegramBot.onText(/\/balance/, async (msg: TelegramBot.Message) => {
      const chatId = msg.chat.id;
      const userId = msg.from?.id;

      if (!userId) {
        await telegramBot.sendMessage(chatId, 'Could not get user ID.');
        return;
      }
      
      await telegramBot.sendTyping(chatId);

      try {
        const hasWallet = crossmintWalletService.hasWallet(userId);

        if (!hasWallet) {
          needsLoginMessage(chatId, 'You need to log in to check your balance.');
          return;
        }

        const balanceData = await crossmintWalletService.getWalletBalance(userId);
        const usdcBalance = balanceData?.balances.find(b => b.currency === 'USDC')?.amount || '0.00';
        
        const message = `*Your Wallet Balance:*\n\n` +
                        `*${escapeMarkdown(parseFloat(usdcBalance).toFixed(2))}* USDC`;

        await telegramBot.sendMessage(chatId, message, { parse_mode: 'MarkdownV2' });

      } catch (error) {
        console.error('Error fetching balance:', error);
        await telegramBot.sendMessage(chatId, 'Could not fetch your balance at this time.');
      }
    });
    
    // /topup command
    telegramBot.onText(/\/topup/, async (msg: TelegramBot.Message) => {
      try {
        const chatId = msg.chat.id;
        const userId = msg.from?.id;

        if (!userId) {
          await telegramBot.sendMessage(chatId, 'Could not identify you. Please try again.');
          return;
        }

        if (!crossmintWalletService.hasWallet(userId)) {
          const userInfo: { username?: string; firstName?: string } = {};
          if (msg.from?.username) userInfo.username = msg.from.username;
          if (msg.from?.first_name) userInfo.firstName = msg.from.first_name;

          const authLink = crossmintWalletService.generateAuthLink(userId, userInfo);
          if (authLink) {
            await telegramBot.sendMessage(
              chatId,
              'You need a wallet to top up. Please create one first.',
              {
                reply_markup: {
                  inline_keyboard: [[{ text: 'Create Wallet', url: authLink }]],
                },
              },
            );
          } else {
            await telegramBot.sendMessage(chatId, 'Could not generate a wallet creation link. Please try again later.');
          }
          return;
        }

        const userWallet = crossmintWalletService.getUser(userId);
        if (!userWallet || !userWallet.walletAddress) {
          await telegramBot.sendMessage(chatId, 'Error retrieving your wallet address. Please try creating it again via /login.');
          return;
        }

        // Embed wallet address directly into the state
        const state = Buffer.from(JSON.stringify({ 
          userId,
          walletAddress: userWallet.walletAddress,
          crossmintUserId: userWallet.crossmintUserId,
          email: userWallet.email,
          authToken: userWallet.authToken
        })).toString('base64');
        
        const topUpUrl = `${config.webApp.url}/topup?state=${state}`;

        if (!crossmintWalletService.isValidWebAppUrl(topUpUrl)) {
          await telegramBot.sendMessage(chatId, 'The top-up service is currently unavailable. Please try again later.');
          return;
        }

        await telegramBot.sendMessage(chatId, 'Click the button below to add funds to your wallet.', {
          reply_markup: {
            inline_keyboard: [[{ text: 'Top up Wallet', url: topUpUrl }]],
          },
        });
      } catch (error) {
        console.error('Error during /topup:', error);
        if (msg) {
          await telegramBot.sendMessage(msg.chat.id, 'An unexpected error occurred. Please try again later.');
        }
      }
    });

    // /logout command
    telegramBot.onText(/\/logout/, async (msg: TelegramBot.Message) => {
      try {
        const chatId = msg.chat.id;
        const userId = msg.from?.id;

        if (!userId) {
          await telegramBot.sendMessage(chatId, 'Could not identify you. Please try again.');
          return;
  }

        // Check if user is actually logged in
        if (!crossmintWalletService.isUserLoggedIn(userId)) {
          await telegramBot.sendMessage(chatId, 
            '❓ You are not currently logged in.\n\n' +
            'Use /login to connect your Crossmint wallet.',
            {
              reply_markup: {
                inline_keyboard: [[{ text: 'Log In', callback_data: 'login_prompt' }]]
              }
            }
          );
          return;
        }

        const userWallet = crossmintWalletService.getUser(userId);
        const walletAddress = userWallet?.walletAddress;

        // Clear user data from wallet service
        const logoutSuccess = crossmintWalletService.clearUser(userId);

        if (logoutSuccess) {
          // Also clear user memory for complete cleanup
          memoryUtils.clearUserMemory(userId);

          // Send confirmation message
          const address = walletAddress ? 
            `${walletAddress.substring(0, 8)}...${walletAddress.substring(-6)}` : 
            'your wallet';

          await telegramBot.sendMessage(chatId, 
            `🚪 *Logged Out Successfully*\n\n` +
            `✅ You have been logged out from ${escapeMarkdown(address)}\\.\n\n` +
            `Your session data has been cleared\\. To use wallet features again, you'll need to log back in\\.`,
            {
              parse_mode: 'MarkdownV2',
              reply_markup: {
                inline_keyboard: [
                  [{ text: '🔑 Log Back In', callback_data: 'login_prompt' }],
                  [{ text: '🔍 Continue Shopping', callback_data: 'search_more' }]
                ]
              }
            }
          );
        } else {
          await telegramBot.sendMessage(chatId, 
            '❌ Logout failed. You may not have been logged in.\n\n' +
            'Use /login to connect your wallet.'
          );
        }

      } catch (error) {
        console.error('Error during /logout:', error);
        if (msg) {
          await telegramBot.sendMessage(msg.chat.id, 'An unexpected error occurred during logout. Please try again later.');
        }
      }
    });
  }

  /**
   * Handle delegation-related commands
   */
  private static setupDelegationCommands(): void {
    // /delegate command
    telegramBot.onText(/\/delegate/, async (msg: TelegramBot.Message) => {
      const chatId = msg.chat.id;
      const userId = msg.from?.id;

      if (!userId) {
        await telegramBot.sendMessage(chatId, 'Could not get user ID.');
        return;
      }

      await telegramBot.sendTyping(chatId);
      
      try {
        // Check if user has a wallet first
        if (!crossmintWalletService.hasWallet(userId)) {
          const userInfo: { username?: string; firstName?: string } = {};
          if (msg.from?.username) userInfo.username = msg.from.username;
          if (msg.from?.first_name) userInfo.firstName = msg.from.first_name;

          const authLink = crossmintWalletService.generateAuthLink(userId, userInfo);
          if (authLink) {
            await telegramBot.sendMessage(
              chatId,
              'You need a wallet to set up delegation. Please create one first.',
              {
                reply_markup: {
                  inline_keyboard: [[{ text: 'Create Wallet', url: authLink }]],
                },
              },
            );
          } else {
            await telegramBot.sendMessage(chatId, 'Could not generate a wallet creation link. Please try again later.');
          }
          return;
        }

        const delegationUrl = this.getDelegationUrl(userId);
        
        await telegramBot.sendMessage(chatId, 
          '🤖 *Enable Fast Shopping*\n\n' +
          'Allow the bot to automatically sign transactions for instant purchases without manual approval\\.\n\n' +
          '*Benefits:*\n' +
          '• Instant purchases without waiting\n' +
          '• Seamless shopping experience\n' +
          '• You can revoke anytime\n' +
          '• Your wallet remains secure\n\n' +
          'Click the button below to set up delegation\\.',
          {
            parse_mode: 'MarkdownV2',
            reply_markup: {
              inline_keyboard: [[{ text: '⚡ Enable Fast Shopping', url: delegationUrl }]]
            }
          }
        );
        
      } catch (error) {
        console.error('Error during /delegate:', error);
        await telegramBot.sendMessage(chatId, 'An error occurred. Please try again later.');
      }
    });
  }

  /**
   * Handle callback-related commands
   */
  private static setupCallbackHandlers(): void {
    telegramBot.getBotInstance().on('callback_query', async (callbackQuery) => {
      try {
        const data = callbackQuery.data;
        
        if (!data) return;

        console.log(`📞 Callback query: ${data}`);

        // Handle search pagination callbacks
        if (data.startsWith('search:')) {
          await handleSearchCallback(telegramBot.getBotInstance(), callbackQuery);
          return;
        }

        // Handle auto-search suggestions
        if (data.startsWith('auto_search:')) {
          await handleAutoSearchCallback(telegramBot.getBotInstance(), callbackQuery);
          return;
        }

        // Handle Crossmint purchase callbacks
        if (data.startsWith('crossmint_buy:')) {
          await handleCrossmintBuy(telegramBot.getBotInstance(), callbackQuery);
          return;
        }

        // Handle order status check
        if (data.startsWith('check_order:')) {
          const orderId = data.split(':')[1];
          if (!orderId) {
            await telegramBot.getBotInstance().answerCallbackQuery(callbackQuery.id, {
              text: 'Invalid order ID',
              show_alert: true
            });
            return;
          }

          await telegramBot.getBotInstance().answerCallbackQuery(callbackQuery.id, {
            text: 'Checking order status...'
          });

          try {
            // Import the checkout service to check order status
            const { crossmintHeadlessCheckoutService } = await import('../../commerce/crossmint/checkout.js');
            const orderData = await crossmintHeadlessCheckoutService.getOrder(orderId);
            
            const chatId = callbackQuery.message?.chat.id;
            if (chatId) {
              const status = orderData.payment?.status || 'unknown';
              const phase = orderData.phase || 'unknown';
              
              let statusMessage = `📋 *Order Status Update*\n\n` +
                `*Order ID:* ${escapeMarkdown(orderId)}\n` +
                `*Payment Status:* ${escapeMarkdown(status)}\n` +
                `*Phase:* ${escapeMarkdown(phase)}\n\n`;

              if (status === 'completed' || phase === 'completed') {
                statusMessage += '✅ *Order Completed Successfully\\!*\n\n' +
                  'Your payment has been processed and the product will be shipped to your address\\.';
              } else if (status === 'awaiting-payment') {
                statusMessage += '⏳ *Awaiting Payment*\n\n' +
                  'Your order is still waiting for payment confirmation\\. This may take a few minutes to process\\.\n\n' +
                  'If this persists, please contact Crossmint support\\.';
              } else if (status === 'failed') {
                statusMessage += '❌ *Payment Failed*\n\n' +
                  'There was an issue processing your payment\\. Please try again or contact support\\.';
              } else {
                statusMessage += `Status: ${escapeMarkdown(status)}`;
              }

              await telegramBot.getBotInstance().sendMessage(chatId, statusMessage, {
                parse_mode: 'MarkdownV2',
                reply_markup: {
                  inline_keyboard: [
                    [
                      {
                        text: '🔄 Check Again',
                        callback_data: `check_order:${orderId}`
                      }
                    ],
                    [
                      {
                        text: '🔍 Search More',
                        callback_data: 'search_more'
                      }
                    ]
                  ]
                }
              });
            }
          } catch (error) {
            console.error('Error checking order status:', error);
            await telegramBot.getBotInstance().answerCallbackQuery(callbackQuery.id, {
              text: 'Error checking order status',
              show_alert: true
            });
          }
          return;
        }

        // Handle checkout cancellation
        if (data === 'checkout_cancel') {
          await handleCheckoutCancel(telegramBot.getBotInstance(), callbackQuery);
          return;
        }

        // Handle wallet buy now
        if (data === 'wallet_buy_now') {
          await telegramBot.getBotInstance().answerCallbackQuery(callbackQuery.id, { 
            text: 'Starting wallet purchase...' 
          });
          
          const chatId = callbackQuery.message?.chat.id;
          if (chatId) {
            await telegramBot.getBotInstance().sendMessage(chatId, 
              `✅ *Wallet Purchase*\n\n` +
              `Please provide your email address for order confirmation:`,
              { parse_mode: 'MarkdownV2' }
            );
          }
          return;
        }

        // Handle search more products
        if (data === 'search_more') {
          await telegramBot.getBotInstance().answerCallbackQuery(callbackQuery.id);
          const chatId = callbackQuery.message?.chat.id;
          if (chatId) {
            await telegramBot.getBotInstance().sendMessage(chatId, 
              `🔍 *Ready to Search*\n\nUse /search followed by your query\\.\n\nExample: /search wireless headphones`,
              { parse_mode: 'MarkdownV2' }
            );
          }
          return;
        }

        // Handle login prompt callback
        if (data === 'login_prompt') {
          const userId = callbackQuery.from.id;
          const url = this.getLoginUrl(userId);
          const chatId = callbackQuery.message?.chat.id;

          if (chatId) {
            await telegramBot.sendMessage(chatId, 'Please log in to your Crossmint wallet to continue.', {
              reply_markup: {
                inline_keyboard: [[{ text: 'Log in to Crossmint', url }]]
              }
            });
          }
          await telegramBot.getBotInstance().answerCallbackQuery(callbackQuery.id);
          return;
        }

        // Handle delegation prompt callback
        if (data === 'delegate_prompt') {
          const userId = callbackQuery.from.id;
          const delegationUrl = this.getDelegationUrl(userId);
          const chatId = callbackQuery.message?.chat.id;

          if (chatId) {
            await telegramBot.sendMessage(chatId, 
              '🤖 *Enable Fast Shopping*\n\n' +
              'Set up delegation to allow instant purchases without manual approval\\.',
              {
                parse_mode: 'MarkdownV2',
                reply_markup: {
                  inline_keyboard: [[{ text: '⚡ Enable Fast Shopping', url: delegationUrl }]]
                }
              }
            );
          }
          await telegramBot.getBotInstance().answerCallbackQuery(callbackQuery.id);
          return;
        }

        // Handle wallet callbacks
        if (data.startsWith('topup_')) {
          const amount = parseInt(data.split('_')[1] || '0');
          if (amount > 0) {
            const userId = callbackQuery.from.id;
            try {
              const topupLink = crossmintWalletService.generateTopUpLink(userId, amount, 'USD');
              
              if (!topupLink) {
                await telegramBot.getBotInstance().answerCallbackQuery(callbackQuery.id, {
                  text: 'Top-up currently unavailable',
                  show_alert: true
                });
                return;
              }
              
              await telegramBot.getBotInstance().answerCallbackQuery(callbackQuery.id, { 
                text: `Redirecting to $${amount} top-up...` 
              });
              
              const chatId = callbackQuery.message?.chat.id;
              if (chatId) {
                // DEVELOPMENT MODE: Use text URL for local testing
              if (process.env.NODE_ENV === 'development' && topupLink.includes('localhost')) {
                console.log(`🧪 Development mode: Using plain text URL for callback topup instead of button`);
                
                // For development, just send the URL as text (not as a clickable button)
                const devMessage = `💳 *Top Up \\$${escapeMarkdown(amount.toString())}*\n\n` +
                  `*Local Development Testing:*\n` +
                  `Copy and paste this URL in your browser to add funds:\n\n` +
                  `\`${topupLink}\`\n\n` +
                  `*After payment, return here and use /balance to see your updated balance\\.*`;
                
                await telegramBot.getBotInstance().editMessageText(
                  devMessage,
                  {
                    chat_id: chatId,
                    message_id: callbackQuery.message?.message_id,
                    parse_mode: 'MarkdownV2'
                  }
                );
              }
              // PRODUCTION MODE: Use inline keyboard button with HTTPS URL
              else {
                await telegramBot.getBotInstance().editMessageText(
                  `💳 *Top Up \\$${escapeMarkdown(amount.toString())}*\n\n` +
                  `Click the link below to add funds to your wallet:\n\n` +
                  `[💰 Add \\$${escapeMarkdown(amount.toString())}](${escapeMarkdown(topupLink)})\n\n` +
                  `*After payment, return here and use /balance to see your updated balance\\.*`,
                  {
                    chat_id: chatId,
                    message_id: callbackQuery.message?.message_id,
                    parse_mode: 'MarkdownV2',
                    reply_markup: {
                      inline_keyboard: [[
                        {
                          text: `💰 Add $${amount}`,
                          url: topupLink
                        }
                      ]]
                    }
                  }
                );
              }
              }
            } catch (error) {
              await telegramBot.getBotInstance().answerCallbackQuery(callbackQuery.id, {
                text: 'Error generating top-up link',
                show_alert: true
              });
            }
          }
          return;
        }

        if (data === 'wallet_topup') {
          await telegramBot.getBotInstance().answerCallbackQuery(callbackQuery.id);
          const chatId = callbackQuery.message?.chat.id;
          if (chatId) {
            await telegramBot.getBotInstance().sendMessage(chatId, 
              `💳 *Top Up Your Wallet*\n\nUse /topup to add funds to your wallet\\.`,
              { parse_mode: 'MarkdownV2' }
            );
          }
          return;
        }

        if (data === 'wallet_refresh') {
          const userId = callbackQuery.from.id;
          const chatId = callbackQuery.message?.chat.id;
          const messageId = callbackQuery.message?.message_id;
          
          if (chatId && messageId) {
            await telegramBot.getBotInstance().answerCallbackQuery(callbackQuery.id, { 
              text: 'Refreshing balance...' 
            });
            
            try {
              const balance = await crossmintWalletService.getWalletBalance(userId);
              if (balance) {
                let message = `*Wallet Balance*\n\n`;
                message += `*Address:* ${escapeMarkdown(balance.walletAddress.substring(0, 10))}\\.\\.\\.\n\n`;
                
                if (balance.balances.length === 0) {
                  message += `*No funds found\\.*\n\n`;
                  message += `Use /topup to add funds to your wallet\\.`;
                } else {
                  message += `*Balances:*\n`;
                  balance.balances.forEach(bal => {
                    message += `• ${escapeMarkdown(bal.amount)} ${escapeMarkdown(bal.currency)} \\(${escapeMarkdown(bal.chain)}\\)\n`;
                  });
                  message += `\n*Last Updated:* ${escapeMarkdown(new Date().toLocaleString())}`;
                }

                await telegramBot.getBotInstance().editMessageText(message, {
                  chat_id: chatId,
                  message_id: messageId,
                  parse_mode: 'MarkdownV2',
                  reply_markup: {
                    inline_keyboard: [[
                      {
                        text: '💳 Top Up Wallet',
                        callback_data: 'wallet_topup'
                      },
                      {
                        text: '🔄 Refresh',
                        callback_data: 'wallet_refresh'
                      }
                    ]]
                  }
                });
              }
            } catch (error) {
              await telegramBot.getBotInstance().answerCallbackQuery(callbackQuery.id, {
                text: 'Error refreshing balance',
                show_alert: true
              });
            }
          }
          return;
        }

        // Handle no-op callbacks (pagination display)
        if (data === 'noop') {
          await telegramBot.getBotInstance().answerCallbackQuery(callbackQuery.id);
          return;
        }

        // Unknown callback
        await telegramBot.getBotInstance().answerCallbackQuery(callbackQuery.id, {
          text: 'Unknown action',
          show_alert: true,
        });

      } catch (error) {
        console.error('❌ Callback query error:', error);
        await telegramBot.getBotInstance().answerCallbackQuery(callbackQuery.id, {
          text: 'An error occurred',
          show_alert: true,
        });
      }
    });
  }
} 