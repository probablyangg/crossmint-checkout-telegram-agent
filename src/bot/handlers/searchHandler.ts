import TelegramBot from 'node-telegram-bot-api';
import { searchAPIService } from '../../commerce/search/searchapi.js';
import { 
  formatProductList, 
  formatSearchError, 
  formatSearchLoading,
  formatSearchHelp
} from '../../commerce/search/formatting.js';
import { addMessage, updateUserPreferences } from '../../utils/memory.js';

// Cache to store search results for checkout (simple in-memory cache)
interface SearchResultCache {
  [userId: number]: {
    products: any[];
    timestamp: number;
    query: string;
  };
}

const searchCache: SearchResultCache = {};
const CACHE_DURATION = 2 * 60 * 60 * 1000; // 2 hours (extended for better UX)

/**
 * Store search results for a user (for later checkout access)
 */
export function cacheSearchResults(userId: number, products: any[], query: string): void {
  console.log(`💾 Caching search results for user ${userId}:`);
  console.log(`   - Query: "${query}"`);
  console.log(`   - Products count: ${products.length}`);
  
  searchCache[userId] = {
    products,
    timestamp: Date.now(),
    query
  };
  
  console.log(`   - Cache stored successfully`);
  
  // Clean up old cache entries
  const now = Date.now();
  let cleanedCount = 0;
  for (const [uid, cache] of Object.entries(searchCache)) {
    if (now - cache.timestamp > CACHE_DURATION) {
      delete searchCache[Number(uid)];
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`   - Cleaned up ${cleanedCount} expired cache entries`);
  }
}

/**
 * Get cached search results for a user
 */
export function getCachedSearchResults(userId: number): { products: any[]; query: string } | null {
  const cache = searchCache[userId];
  console.log(`🔍 Getting cached search results for user ${userId}:`);
  console.log(`   - Cache exists: ${!!cache}`);
  
  if (!cache) {
    console.log(`   - No cache found for user ${userId}`);
    return null;
  }
  
  const isExpired = Date.now() - cache.timestamp > CACHE_DURATION;
  console.log(`   - Cache age: ${Math.round((Date.now() - cache.timestamp) / 1000 / 60)} minutes`);
  console.log(`   - Is expired: ${isExpired}`);
  console.log(`   - Products count: ${cache.products?.length || 0}`);
  
  if (isExpired) {
    console.log(`   - Deleting expired cache for user ${userId}`);
    delete searchCache[userId];
    return null;
  }
  
  return { products: cache.products, query: cache.query };
}

/**
 * Get a specific product from cached results by index
 */
export function getCachedProduct(userId: number, index: number): any | null {
  console.log(`🛒 Getting cached product: user ${userId}, index ${index}`);
  
  const cache = getCachedSearchResults(userId);
  if (!cache) {
    console.log(`   - No cache available for user ${userId}`);
    return null;
  }
  
  console.log(`   - Cache has ${cache.products.length} products`);
  console.log(`   - Requested index: ${index}`);
  
  if (index < 0 || index >= cache.products.length) {
    console.log(`   - Index ${index} out of bounds (0-${cache.products.length - 1})`);
    return null;
  }
  
  const product = cache.products[index];
  console.log(`   - Found product: ${product.title || 'Unknown'}`);
  
  return product;
}

/**
 * Handle /search command for Amazon product search
 */
export async function handleSearchCommand(bot: TelegramBot, msg: TelegramBot.Message): Promise<void> {
  const chatId = msg.chat.id;
  const text = msg.text || '';
  
  // Parse command: /search query [page]
  const parts = text.trim().split(' ');
  
  if (parts.length < 2) {
    // Show help if no query provided
    await bot.sendMessage(chatId, formatSearchHelp(), {
      parse_mode: 'MarkdownV2'
    });
    return;
  }

  // Extract query and page number
  const lastPart = parts[parts.length - 1] || '';
  const pageNum = parseInt(lastPart);
  let query: string;
  let page: number = 1;
  
  if (!isNaN(pageNum) && pageNum > 0 && parts.length > 2) {
    // Last part is a valid page number
    query = parts.slice(1, -1).join(' ');
    page = pageNum;
  } else {
    // No page number, use all parts as query
    query = parts.slice(1).join(' ');
  }

  if (query.trim().length === 0) {
    await bot.sendMessage(chatId, formatSearchHelp(), {
      parse_mode: 'MarkdownV2'
    });
    return;
  }

  // Validate query length
  if (query.length > 200) {
    await bot.sendMessage(chatId, 
      formatSearchError(query, 'Search query is too long. Please use fewer than 200 characters.'), 
      { parse_mode: 'MarkdownV2' }
    );
    return;
  }

  console.log(`🔍 User ${msg.from?.username || msg.from?.id} searching for: "${query}" (page ${page})`);
  
  // Send loading message
  const loadingMessage = await bot.sendMessage(chatId, formatSearchLoading(query), {
    parse_mode: 'MarkdownV2'
  });

  try {
    // Perform search with pagination
    const searchOptions = {
      num: 25, // Get more results for pagination
      page: 1, // Always start from page 1, we'll handle pagination in formatting
    };

    const products = await searchAPIService.searchWithRetry(query, searchOptions);
    
    // Cache search results for checkout access and store in memory
    if (msg.from?.id) {
      cacheSearchResults(msg.from.id, products, query);
      
      // Store search in memory and update preferences
      addMessage(msg.from.id, 'user', `/search ${query}`, 'command');
      addMessage(msg.from.id, 'assistant', `Found ${products.length} products for "${query}"`, 'text');
      updateUserPreferences(msg.from.id, { lastSearchQuery: query });
    }
    
    // Format results for display
    const { message: formattedResults, keyboard } = formatProductList(products, query, page, 5);
    
    // Update the loading message with results
    await bot.editMessageText(formattedResults, {
      chat_id: chatId,
      message_id: loadingMessage.message_id,
      parse_mode: 'MarkdownV2',
      reply_markup: keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined
    });

    // Log successful search
    console.log(`✅ Search completed: Found ${products.length} products for "${query}"`);

  } catch (error) {
    console.error('❌ Search error:', error);
    
    let errorMessage = 'An unexpected error occurred';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    // Update loading message with error
    await bot.editMessageText(formatSearchError(query, errorMessage), {
      chat_id: chatId,
      message_id: loadingMessage.message_id,
      parse_mode: 'MarkdownV2'
    });
  }
}

/**
 * Handle pagination callback queries
 */
export async function handleSearchCallback(bot: TelegramBot, callbackQuery: TelegramBot.CallbackQuery): Promise<void> {
  const chatId = callbackQuery.message?.chat.id;
  const messageId = callbackQuery.message?.message_id;
  const data = callbackQuery.data || '';
  
  if (!chatId || !messageId) {
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: 'Error: Invalid callback data',
      show_alert: true
    });
    return;
  }

  // Parse callback data: search:query:page
  const parts = data.split(':');
  if (parts.length !== 3 || parts[0] !== 'search') {
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: 'Invalid search callback',
      show_alert: true
    });
    return;
  }

  const query = parts[1] || '';
  const page = parseInt(parts[2] || '1');

  if (isNaN(page) || page < 1) {
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: 'Invalid page number',
      show_alert: true
    });
    return;
  }

  console.log(`📄 User requesting page ${page} for query: "${query}"`);

  try {
    // Acknowledge the callback immediately
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: `Loading page ${page}...`
    });

    // Perform search again (we could cache this in a real app)
    const searchOptions = {
      num: 25,
      page: 1,
    };

    const products = await searchAPIService.searchWithRetry(query, searchOptions);
    
    // Format results for the requested page
    const { message: formattedResults, keyboard } = formatProductList(products, query, page, 5);
    
    // Update the message with new page
    await bot.editMessageText(formattedResults, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'MarkdownV2',
      reply_markup: keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined
    });

    console.log(`✅ Page ${page} loaded for query: "${query}"`);

  } catch (error) {
    console.error('❌ Pagination error:', error);
    
    let errorMessage = 'Failed to load page';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: errorMessage,
      show_alert: true
    });
  }
}

/**
 * Handle natural language search queries (non-command messages)
 */
export async function handleNaturalSearch(bot: TelegramBot, msg: TelegramBot.Message): Promise<void> {
  const chatId = msg.chat.id;
  const text = msg.text || '';
  
  // Check if message looks like a product search
  const searchKeywords = [
    'find', 'search', 'look for', 'show me', 'buy', 'purchase', 
    'get me', 'where can i', 'amazon', 'product', 'price'
  ];
  
  const lowerText = text.toLowerCase();
  const isSearchIntent = searchKeywords.some(keyword => lowerText.includes(keyword));
  
  if (!isSearchIntent || text.length < 5) {
    // Not a search intent, ignore
    return;
  }

  // Extract potential product query from natural language
  let query = text;
  
  // Remove common search prefixes
  const prefixes = [
    'find me', 'search for', 'look for', 'show me', 'buy me', 
    'get me', 'find', 'search', 'buy', 'purchase'
  ];
  
  for (const prefix of prefixes) {
    if (lowerText.startsWith(prefix)) {
      query = text.substring(prefix.length).trim();
      break;
    }
  }
  
  // Clean up the query
  query = query
    .replace(/^(a|an|the)\s+/i, '') // Remove articles
    .replace(/\s+on\s+amazon$/i, '') // Remove "on amazon"
    .replace(/\s+please$/i, '') // Remove "please"
    .trim();

  if (query.length < 3) {
    // Query too short after cleaning
    return;
  }

  console.log(`🤖 Natural language search detected: "${text}" -> "${query}"`);
  
  // Send a suggestion message
  await bot.sendMessage(chatId, 
    `🔍 I can help you search for "${query}" on Amazon\\!\n\n` +
    `Use: /search ${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\n\n` +
    `Or I can search now if you'd like\\. What would you prefer?`,
    {
      parse_mode: 'MarkdownV2',
      reply_markup: {
        inline_keyboard: [[
          {
            text: '🔍 Search Now',
            callback_data: `auto_search:${query}`
          },
          {
            text: '❌ Cancel',
            callback_data: 'cancel_search'
          }
        ]]
      }
    }
  );
}

/**
 * Handle auto-search callback from natural language processing
 */
export async function handleAutoSearchCallback(bot: TelegramBot, callbackQuery: TelegramBot.CallbackQuery): Promise<void> {
  const chatId = callbackQuery.message?.chat.id;
  const messageId = callbackQuery.message?.message_id;
  const data = callbackQuery.data || '';
  
  if (!chatId || !messageId) {
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: 'Error: Invalid callback data',
      show_alert: true
    });
    return;
  }

  if (data === 'cancel_search') {
    await bot.editMessageText('🚫 Search cancelled\\.', {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'MarkdownV2'
    });
    
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: 'Search cancelled'
    });
    return;
  }

  // Parse auto-search callback: auto_search:query
  const parts = data.split(':');
  if (parts.length !== 2 || parts[0] !== 'auto_search') {
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: 'Invalid search callback',
      show_alert: true
    });
    return;
  }

  const query = parts[1] || '';
  
  // Acknowledge callback
  await bot.answerCallbackQuery(callbackQuery.id, {
    text: 'Starting search...'
  });

  // Update message to show loading
  await bot.editMessageText(formatSearchLoading(query), {
    chat_id: chatId,
    message_id: messageId,
    parse_mode: 'MarkdownV2'
  });

  try {
    // Perform the search
    const searchOptions = {
      num: 25,
      page: 1,
    };

    const products = await searchAPIService.searchWithRetry(query, searchOptions);
    
    // Cache search results for checkout access
    const userId = callbackQuery.from.id;
    if (userId) {
      cacheSearchResults(userId, products, query);
      console.log(`✅ Cached ${products.length} products for user ${userId} (auto-search: "${query}")`);
    }
    
    // Format and display results
    const { message: formattedResults, keyboard } = formatProductList(products, query, 1, 5);
    
    await bot.editMessageText(formattedResults, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'MarkdownV2',
      reply_markup: keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined
    });

    console.log(`✅ Auto-search completed: Found ${products.length} products for "${query}"`);

  } catch (error) {
    console.error('❌ Auto-search error:', error);
    
    let errorMessage = 'Search failed';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    await bot.editMessageText(formatSearchError(query, errorMessage), {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'MarkdownV2'
    });
  }
} 