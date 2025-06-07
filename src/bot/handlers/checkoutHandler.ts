import type TelegramBot from 'node-telegram-bot-api';
import { telegramBot } from '../platforms/telegram.js';
import { crossmintWalletService } from '../../commerce/crossmint/wallet.js';
import { crossmintHeadlessCheckoutService, type AmazonProduct, type PhysicalAddress } from '../../commerce/crossmint/checkout.js';
import { escapeMarkdown } from '../../commerce/search/formatting.js';
import { getCachedProduct } from './searchHandler.js';

// Session management for checkout flow
const userSessions = new Map<number, UserSession>();

interface UserSession {
  userId: number;
  selectedProduct?: AmazonProduct;
  email?: string;
  physicalAddress?: PhysicalAddress;
  step: 'product_selected' | 'collecting_email' | 'collecting_address' | 'creating_order' | 'completed';
  productIndex?: number;
}

/**
 * Handle Crossmint "Buy Now" button click
 */
export async function handleCrossmintBuy(
  bot: TelegramBot,
  callbackQuery: TelegramBot.CallbackQuery
): Promise<void> {
  const userId = callbackQuery.from.id;
  const chatId = callbackQuery.message?.chat.id;

  if (!chatId) return;

  try {
    await bot.answerCallbackQuery(callbackQuery.id, { text: 'Starting purchase...' });

    // Extract product index from callback data: "crossmint_buy:0"
    const productIndex = parseInt(callbackQuery.data?.split(':')[1] || '0', 10);
    
    console.log(`🛒 Buy button clicked by user ${userId}, product index: ${productIndex}`);
    console.log(`📞 Callback data: ${callbackQuery.data}`);
    
    // Get the product from search results
    const product = getSelectedProduct(userId, productIndex);
    
    if (!product) {
      console.log(`❌ Product not found for user ${userId}, index ${productIndex}`);
      await bot.sendMessage(chatId, 
        '❌ *Product Not Found*\n\n' +
        'Please search for products again and select one to purchase\\.\n\n' +
        'Use /search to find products\\.',
        { parse_mode: 'MarkdownV2' }
      );
      return;
    }

    console.log(`✅ Product found: ${product.title}`);
    console.log(`🔗 Product URL: ${product.amazonUrl}`);

    // Start wallet-based checkout flow
    await startWalletCheckoutFlow(bot, callbackQuery.message!.chat.id, userId, product, productIndex);

  } catch (error) {
    console.error('Error handling Crossmint buy:', error);
    await bot.sendMessage(chatId, 
      '❌ *Error*\n\nSorry, there was an error starting the purchase\\. Please try again\\.',
      { parse_mode: 'MarkdownV2' }
    );
  }
}

/**
 * Get selected product from cached search results
 */
function getSelectedProduct(userId: number, index: number): AmazonProduct | null {
  try {
    const cachedProduct = getCachedProduct(userId, index);
    
    if (!cachedProduct) {
      console.log(`❌ No cached product found for user ${userId}, index ${index}`);
      return null;
    }

    // Convert search result to AmazonProduct format
    const product: AmazonProduct = {
      title: cachedProduct.title || 'Unknown Product',
      price: cachedProduct.price || cachedProduct.extracted_price?.toString() || '0',
      amazonUrl: cachedProduct.link || '',
      imageUrl: cachedProduct.thumbnail || cachedProduct.image,
      description: cachedProduct.snippet || cachedProduct.description,
    };

    console.log(`✅ Found cached product: ${product.title}`);
    console.log(`🔗 Amazon URL: ${product.amazonUrl}`);
    return product;
    
  } catch (error) {
    console.error('Error getting cached product:', error);
    return null;
  }
}

/**
 * Start wallet-based checkout flow (simplified)
 */
async function startWalletCheckoutFlow(
  bot: TelegramBot,
  chatId: number,
  userId: number,
  product: AmazonProduct,
  productIndex: number
): Promise<void> {
  try {
    // Check if user has a wallet
    if (!crossmintWalletService.hasWallet(userId)) {
      const authLink = crossmintWalletService.generateAuthLink(userId, {});

      if (!authLink) {
        await bot.sendMessage(chatId, 
          '🔐 *Wallet Required*\n\n' +
          `To purchase ${escapeMarkdown(product.title)}, you need a Crossmint wallet\\.\n\n` +
          '*Unfortunately, wallet creation is currently unavailable\\.*\n\n' +
          'Please contact support or try again later\\.',
          { parse_mode: 'MarkdownV2' }
        );
        return;
      }

      // Send wallet creation message
      const message = '🔐 *Wallet Required*\n\n' +
        `To purchase ${escapeMarkdown(product.title)}, you need a Crossmint wallet\\.\n\n` +
        '*Click below to create your wallet and return here to complete your purchase\\.*';

      await bot.sendMessage(chatId, message, {
        parse_mode: 'MarkdownV2',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '🚀 Create Wallet',
                url: authLink
              }
            ],
            [
              {
                text: '❌ Cancel',
                callback_data: 'checkout_cancel'
              }
            ]
          ]
        }
      });
      return;
    }

    // Check wallet balance
    const userWallet = crossmintWalletService.getUser(userId);
    const balance = await crossmintWalletService.getWalletBalance(userId);
    
    if (!balance || balance.balances.length === 0) {
      const topupLink = crossmintWalletService.generateTopUpLink(userId, 50, 'USD');
      
      const message = '💳 *Insufficient Funds*\n\n' +
        `You need funds in your wallet to purchase ${escapeMarkdown(product.title)}\\.\n\n` +
        '*Add funds to your wallet and return here to complete your purchase\\.*';

      const keyboard = [];
      if (topupLink) {
        keyboard.push([{
          text: '💰 Add Funds',
          url: topupLink
        }]);
      }
      keyboard.push([{
        text: '❌ Cancel',
        callback_data: 'checkout_cancel'
      }]);

      await bot.sendMessage(chatId, message, {
        parse_mode: 'MarkdownV2',
        reply_markup: {
          inline_keyboard: keyboard
        }
      });
      return;
    }

    // User has wallet and funds - proceed to collect shipping info
    const session: UserSession = {
      userId,
      selectedProduct: product,
      step: 'collecting_email',
      productIndex: productIndex
    };
    
    if (userWallet?.email) {
      session.email = userWallet.email;
    }
    
    userSessions.set(userId, session);

    // If we already have email from wallet, skip to address
    if (session.email) {
      session.step = 'collecting_address';
      userSessions.set(userId, session);
      await requestShippingAddress(bot, chatId, product);
    } else {
      await requestEmail(bot, chatId, product);
    }

  } catch (error) {
    console.error('Error starting wallet checkout flow:', error);
    await bot.sendMessage(chatId, 
      '❌ *Checkout Error*\n\n' +
      'Sorry, there was an error starting the checkout process\\. Please try again\\.',
      { parse_mode: 'MarkdownV2' }
    );
  }
}

/**
 * Request email from user
 */
async function requestEmail(bot: TelegramBot, chatId: number, product: AmazonProduct): Promise<void> {
  const message = '📧 *Email Required*\n\n' +
    `To purchase ${escapeMarkdown(product.title)}, please provide your email address for order confirmation\\.\n\n` +
    '*Please type your email address:*';

  await bot.sendMessage(chatId, message, {
    parse_mode: 'MarkdownV2',
    reply_markup: {
      inline_keyboard: [[
        {
          text: '❌ Cancel',
          callback_data: 'checkout_cancel'
        }
      ]]
    }
  });
}

/**
 * Request shipping address from user
 */
async function requestShippingAddress(bot: TelegramBot, chatId: number, product: AmazonProduct): Promise<void> {
  const message = '📦 *Shipping Address Required*\n\n' +
    `To ship ${escapeMarkdown(product.title)}, please provide your US shipping address\\.\n\n` +
    '*Format:* Name \\| Address \\| City \\| State \\| ZIP \\| Country\n\n' +
    '*Example:* John Smith \\| 123 Main St \\| New York \\| NY \\| 10001 \\| US\n\n' +
    '*Note:* Currently only US shipping addresses are supported\\.';

  await bot.sendMessage(chatId, message, {
    parse_mode: 'MarkdownV2',
    reply_markup: {
      inline_keyboard: [[
        {
          text: '❌ Cancel',
          callback_data: 'checkout_cancel'
        }
      ]]
    }
  });
}

/**
 * Handle text messages during checkout flow
 */
export async function handleCheckoutMessage(
  bot: TelegramBot,
  msg: TelegramBot.Message
): Promise<boolean> {
  const userId = msg.from?.id;
  const chatId = msg.chat.id;
  const text = msg.text?.trim();

  if (!userId || !text) return false;

  const session = userSessions.get(userId);
  if (!session || !session.selectedProduct) return false;

  try {
    switch (session.step) {
      case 'collecting_email':
        return await handleEmailInput(bot, chatId, userId, text, session);
      
      case 'collecting_address':
        return await handleAddressInput(bot, chatId, userId, text, session);
      
      default:
        return false;
    }
  } catch (error) {
    console.error('Error handling checkout message:', error);
    await bot.sendMessage(chatId, 
      '❌ *Error*\n\n' +
      'Something went wrong\\. Please start over with /search\\.',
      { parse_mode: 'MarkdownV2' }
    );
    userSessions.delete(userId);
    return true;
  }
}

/**
 * Handle email input
 */
async function handleEmailInput(
  bot: TelegramBot,
  chatId: number,
  userId: number,
  email: string,
  session: UserSession
): Promise<boolean> {
  // Validate email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    await bot.sendMessage(chatId, 
      '❌ *Invalid Email*\n\n' +
      'Please enter a valid email address\\.',
      { parse_mode: 'MarkdownV2' }
    );
    return true;
  }

  session.email = email;
  session.step = 'collecting_address';
  userSessions.set(userId, session);

  if (session.selectedProduct) {
    await requestShippingAddress(bot, chatId, session.selectedProduct);
  }

  return true;
}

/**
 * Handle address input
 */
async function handleAddressInput(
  bot: TelegramBot,
  chatId: number,
  userId: number,
  addressText: string,
  session: UserSession
): Promise<boolean> {
  // Parse address: Name | Address | City | State | Postal | Country
  const parts = addressText.split('|').map(p => p.trim());
  
  if (parts.length < 6) {
    await bot.sendMessage(chatId, 
      '❌ *Invalid Address Format*\n\n' +
      'Please provide all required fields:\n' +
      'Name \\| Address \\| City \\| State \\| ZIP \\| Country',
      { parse_mode: 'MarkdownV2' }
    );
    return true;
  }

  // Validate all parts are present
  if (!parts[0] || !parts[1] || !parts[2] || !parts[3] || !parts[4] || !parts[5]) {
    await bot.sendMessage(chatId, 
      '❌ *Incomplete Address*\n\n' +
      'All address fields are required\\. Please provide:\n' +
      'Name \\| Address \\| City \\| State \\| ZIP \\| Country',
      { parse_mode: 'MarkdownV2' }
    );
    return true;
  }

  // Validate country (only US supported)
  const country = parts[5].toUpperCase();
  if (country !== 'US') {
    await bot.sendMessage(chatId, 
      '❌ *Unsupported Country*\n\n' +
      'Currently only US shipping addresses are supported\\.\n\n' +
      'Please provide a US address or contact support for international shipping\\.',
      { parse_mode: 'MarkdownV2' }
    );
    return true;
  }

  session.physicalAddress = {
    name: parts[0],
    line1: parts[1],
    city: parts[2],
    state: parts[3], // Required for US
    postalCode: parts[4],
    country: country,
  };
  session.step = 'creating_order';
  userSessions.set(userId, session);

  // Create the headless Crossmint order
  await createHeadlessOrder(bot, chatId, userId, session);
  return true;
}

/**
 * Create the headless Crossmint order
 */
async function createHeadlessOrder(
  bot: TelegramBot,
  chatId: number,
  userId: number,
  session: UserSession
): Promise<void> {
  try {
    if (!session.selectedProduct || !session.email || !session.physicalAddress) {
      throw new Error('Missing required session data');
    }

    await bot.sendMessage(chatId, 
      '🔄 *Creating Order*\n\n' +
      'Please wait while we process your order\\.\\.\\.',
      { parse_mode: 'MarkdownV2' }
    );

    // Get user wallet info
    const userWallet = crossmintWalletService.getUser(userId);
    if (!userWallet?.walletAddress) {
      throw new Error('User wallet not found');
    }

    // Create headless order with crypto payment
    const orderResponse = await crossmintHeadlessCheckoutService.createWalletAmazonOrder(
      session.selectedProduct,
      session.email,
      userWallet.walletAddress,
      session.physicalAddress
    );

    // Extract order details safely
    const order = orderResponse.order;
    const orderId = order.orderId;
    const orderStatus = order.payment?.status || 'pending';
    const totalAmount = order.quote?.totalPrice?.amount || 'N/A';
    const totalCurrency = order.quote?.totalPrice?.currency?.toUpperCase() || 'USDC';
    const productTitle = session.selectedProduct.title;
    const serializedTransaction = order.payment?.preparation?.serializedTransaction;
    
    console.log(`📋 Order created with status: ${orderStatus}`);
    console.log(`💳 Requires transaction: ${orderResponse.requiresTransaction}`);
    console.log(`🔗 Serialized transaction: ${serializedTransaction ? 'Present' : 'Missing'}`);
    console.log(`🔗 Serialized transaction preview: ${serializedTransaction ? serializedTransaction.substring(0, 20) + '...' : 'N/A'}`);

    // Handle different order states
    if (orderStatus === 'crypto-payer-insufficient-funds') {
      const topupLink = crossmintWalletService.generateTopUpLink(userId, 50, 'USD');
      
      const insufficientFundsMsg = '❌ *Insufficient USDC Funds*\n\n' +
        `Your wallet does not have enough USDC to purchase ${escapeMarkdown(productTitle)}\\.\n\n` +
        `*Required:* ${escapeMarkdown(totalAmount)} ${escapeMarkdown(totalCurrency)}\n\n` +
        '*Please add USDC to your wallet and try again\\.*';

      const keyboard = [];
      if (topupLink) {
        keyboard.push([{
          text: '💰 Add Funds',
          url: topupLink
        }]);
      }
      keyboard.push([{
        text: '🔍 Search Again',
        callback_data: 'search_more'
      }]);

      await bot.sendMessage(chatId, insufficientFundsMsg, {
        parse_mode: 'MarkdownV2',
        reply_markup: {
          inline_keyboard: keyboard
        }
      });
      return;
    }

    if (order.quote.status === 'requires-physical-address') {
      throw new Error('Physical address validation failed. Please check your shipping address.');
    }

    // Check if we have a serialized transaction that needs to be signed
    // This follows the Crossmint API guide: if serializedTransaction exists, it needs to be signed
    if (serializedTransaction) {
      // Send processing message first
      await bot.sendMessage(chatId, 
        '🔄 *Processing Your Order*\n\n' +
        `*Order ID:* ${escapeMarkdown(orderId)}\n` +
        `*Product:* ${escapeMarkdown(productTitle)}\n` +
        `*Total:* ${escapeMarkdown(totalAmount)} ${escapeMarkdown(totalCurrency)}\n\n` +
        `⏳ Signing transaction\\.\\.\\. Please wait\\.`,
        { parse_mode: 'MarkdownV2' }
      );

      // Sign the transaction automatically
      console.log(`🔐 Signing transaction for order ${orderId}`);
      const paymentChain = order?.payment?.preparation?.chain || 'base-sepolia';
      const signingResult = await crossmintHeadlessCheckoutService.signOrderTransaction(
        userWallet.walletAddress,
        serializedTransaction,
        paymentChain
      );

      if (signingResult.success) {
        console.log(`✅ Transaction signed successfully: ${signingResult.transactionId}`);
        
        // Transaction completed successfully - send success message
        const successMessage = 
          `✅ *Payment Successful\\!*\\n\\n` +
          `*Order ID:* ${escapeMarkdown(orderId)}\\n` +
          `*Product:* ${escapeMarkdown(productTitle)}\\n` +
          `*Total:* ${escapeMarkdown(totalAmount)} ${escapeMarkdown(totalCurrency)}\\n` +
          (signingResult.transactionId ? `*Transaction ID:* ${escapeMarkdown(signingResult.transactionId)}\\n` : '') +
          `\\n💰 Payment has been deducted from your wallet\\.\\n` +
          `📦 Your order is now being processed for shipping\\.\\n\\n` +
          `You will receive updates via email and can check order status below\\.`;

        await bot.sendMessage(chatId, successMessage, {
          parse_mode: 'MarkdownV2',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '🔄 Check Order Status',
                  callback_data: `check_order:${orderId}`
                }
              ],
              [
                {
                  text: '🔍 Search More Products',
                  callback_data: 'search_more'
                }
              ]
            ]
          }
        });

        // Start order monitoring
        startOrderMonitoring(orderId, userId);
        
      } else {
        console.error(`❌ Transaction signing failed: ${signingResult.error}`);
        
        const failureMessage = '❌ *Payment Failed*\\n\\n' +
          `Transaction could not be completed\\. Please try again\\.\\n\\n` +
          `*Error:* ${escapeMarkdown(signingResult.error || 'Unknown error')}`;

        await bot.sendMessage(chatId, failureMessage, {
          parse_mode: 'MarkdownV2',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '🔄 Try Again',
                  callback_data: `crossmint_buy:${session.productIndex || 0}`
                }
              ]
            ]
          }
        });
      }
    } else {
      // Success - order completed automatically (typical for custodial wallets)
      const successMessage = '✅ *Order Created Successfully*\n\n' +
        `*Order ID:* ${escapeMarkdown(orderId)}\n` +
        `*Product:* ${escapeMarkdown(productTitle)}\n` +
        `*Total:* ${escapeMarkdown(totalAmount)} ${escapeMarkdown(totalCurrency)}\n` +
        `*Status:* ${escapeMarkdown(orderStatus)}\n\n` +
        '*Next Steps:*\n' +
        '• Payment will be processed using your USDC balance\n' +
        '• You will receive order confirmation via email\n' +
        '• Your product will be shipped to the provided address\n\n' +
        '*Thank you for your purchase\\!*';

      await bot.sendMessage(chatId, successMessage, {
        parse_mode: 'MarkdownV2',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '🔄 Check Order Status',
                callback_data: `check_order:${orderId}`
              }
            ],
            [
              {
                text: '🔍 Search More Products',
                callback_data: 'search_more'
              }
            ]
          ]
        }
      });

      // Start automatic order monitoring
      startOrderMonitoring(orderId, userId);
    }

    console.log(`✅ Crossmint checkout process completed for user ${userId}: ${orderId}`);

    // Clean up session
    userSessions.delete(userId);

  } catch (error) {
    console.error('Error creating headless order:', error);
    
    let errorMessage = 'Unknown error occurred';
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    // Specific error handling
    if (errorMessage.includes('Insufficient USDC funds')) {
      const topupLink = crossmintWalletService.generateTopUpLink(userId, 50, 'USD');
      
      const errorMsg = '❌ *Insufficient USDC Funds*\n\n' +
        'Your wallet does not have enough USDC for this purchase\\.\n\n' +
        'Please add USDC to your wallet and try again\\.';

      const keyboard = [];
      if (topupLink) {
        keyboard.push([{
          text: '💰 Add Funds',
          url: topupLink
        }]);
      }
      keyboard.push([{
        text: '🔍 Try Again',
        callback_data: 'search_more'
      }]);

      await bot.sendMessage(chatId, errorMsg, { 
        parse_mode: 'MarkdownV2',
        reply_markup: {
          inline_keyboard: keyboard
        }
      });
    } else if (errorMessage.includes('US shipping addresses')) {
      await bot.sendMessage(chatId, 
        '❌ *Shipping Restriction*\n\n' +
        'Currently only US shipping addresses are supported\\.\n\n' +
        'Please contact support for international shipping options\\.',
        { 
          parse_mode: 'MarkdownV2',
          reply_markup: {
            inline_keyboard: [[
              {
                text: '🔍 Search Again',
                callback_data: 'search_more'
              }
            ]]
          }
        }
      );
    } else {
      // General error message
      const errorMsg = '❌ *Order Creation Failed*\n\n' +
        `Error: ${escapeMarkdown(errorMessage)}\n\n` +
        'Please try again or contact support\\.';

      await bot.sendMessage(chatId, errorMsg, { 
        parse_mode: 'MarkdownV2',
        reply_markup: {
          inline_keyboard: [[
            {
              text: '🔍 Try Again',
              callback_data: 'search_more'
            }
          ]]
        }
      });
    }

    // Clean up session
    userSessions.delete(userId);
  }
}

/**
 * Handle wallet buy now callback
 */
export async function handleWalletBuyCallback(
  bot: TelegramBot,
  callbackQuery: TelegramBot.CallbackQuery
): Promise<void> {
  const userId = callbackQuery.from.id;
  const chatId = callbackQuery.message?.chat.id;

  if (!chatId) return;

  const session = userSessions.get(userId);
  if (!session || !session.selectedProduct) {
    await bot.answerCallbackQuery(callbackQuery.id, { text: 'Session expired' });
    return;
  }

  await bot.answerCallbackQuery(callbackQuery.id, { text: 'Processing...' });

  // If we have email from wallet, go to address, otherwise collect email
  if (session.email) {
    session.step = 'collecting_address';
    userSessions.set(userId, session);
    await requestShippingAddress(bot, chatId, session.selectedProduct);
  } else {
    await requestEmail(bot, chatId, session.selectedProduct);
  }
}

/**
 * Handle checkout cancellation
 */
export async function handleCheckoutCancel(
  bot: TelegramBot,
  callbackQuery: TelegramBot.CallbackQuery
): Promise<void> {
  const userId = callbackQuery.from.id;
  const chatId = callbackQuery.message?.chat.id;

  if (!chatId) return;

  userSessions.delete(userId);

  await bot.answerCallbackQuery(callbackQuery.id, { text: 'Checkout cancelled' });
  
  await bot.sendMessage(chatId, 
    '❌ *Checkout Cancelled*\n\n' +
    'Your checkout has been cancelled\\. Use /search to find products\\.',
    { parse_mode: 'MarkdownV2' }
  );
}

/**
 * Get user session (for debugging/admin)
 */
export function getUserSession(userId: number): UserSession | undefined {
  return userSessions.get(userId);
}

/**
 * Start monitoring an order and notify user when completed
 */
async function startOrderMonitoring(orderId: string, userId: number): Promise<void> {
  console.log(`🔍 Starting simple order monitoring for ${orderId}`);
  
  // Give the transaction some time to process, then check once
  setTimeout(async () => {
    try {
      const { crossmintHeadlessCheckoutService } = await import('../../commerce/crossmint/checkout.js');
      const orderData = await crossmintHeadlessCheckoutService.getOrder(orderId);
      
      if (orderData && orderData.payment) {
        const status = orderData.payment.status;
        const phase = orderData.phase;
        
        console.log(`📋 Order ${orderId} final status check: ${status} (${phase})`);
        
        if (status === 'completed' || phase === 'completed') {
          // Notify user of completion
          const completionMessage = 
            `✅ *Order Completed Successfully\\!*\n\n` +
            `*Order ID:* ${escapeMarkdown(orderId)}\n` +
            `Your payment has been processed and the product will be shipped to your address\\.\n\n` +
            `Thank you for your purchase\\!`;
          
          await telegramBot.getBotInstance().sendMessage(userId, completionMessage, {
            parse_mode: 'MarkdownV2',
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: '🔍 Search More Products',
                    callback_data: 'search_more'
                  }
                ]
              ]
            }
          });
          
          console.log(`✅ Order ${orderId} completed - user ${userId} notified`);
        } else if (status === 'failed') {
          // Notify user of failure
          const failureMessage = 
            `❌ *Order Payment Failed*\n\n` +
            `*Order ID:* ${escapeMarkdown(orderId)}\n` +
            `There was an issue processing your payment\\. Please try again or contact support\\.`;
          
          await telegramBot.getBotInstance().sendMessage(userId, failureMessage, {
            parse_mode: 'MarkdownV2'
          });
          
          console.log(`❌ Order ${orderId} failed - user ${userId} notified`);
        } else {
          console.log(`⏳ Order ${orderId} still processing (${status})`);
          // User can manually check status using the button if needed
        }
      }
      
    } catch (error) {
      console.error(`❌ Error checking final order status ${orderId}:`, error);
    }
  }, 10000); // Check once after 10 seconds
} 