import { ProductResult } from './searchapi.js';

/**
 * Format product price for display
 */
export function formatPrice(product: ProductResult): string {
  if (product.extracted_price) {
    return `$${product.extracted_price.toFixed(2)}`;
  }
  if (product.price) {
    return product.price;
  }
  return 'Price not available';
}

/**
 * Format product rating display
 */
export function formatRating(product: ProductResult): string {
  if (product.rating && product.reviews) {
    const stars = '⭐'.repeat(Math.floor(product.rating));
    const ratingText = escapeMarkdown(product.rating.toString());
    const reviewsText = escapeMarkdown(product.reviews.toLocaleString());
    return `${stars} ${ratingText}/5 \\(${reviewsText} reviews\\)`;
  }
  if (product.rating) {
    const stars = '⭐'.repeat(Math.floor(product.rating));
    const ratingText = escapeMarkdown(product.rating.toString());
    return `${stars} ${ratingText}/5`;
  }
  return '⭐ No ratings yet';
}

/**
 * Truncate text to fit Telegram message limits
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Escape special Markdown characters for Telegram
 */
export function escapeMarkdown(text: string): string {
  return text
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/~/g, '\\~')
    .replace(/`/g, '\\`')
    .replace(/>/g, '\\>')
    .replace(/#/g, '\\#')
    .replace(/\+/g, '\\+')
    .replace(/-/g, '\\-')
    .replace(/=/g, '\\=')
    .replace(/\|/g, '\\|')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\./g, '\\.')
    .replace(/!/g, '\\!');
}

/**
 * Format a single product for Telegram display
 */
export function formatSingleProduct(product: ProductResult, index: number): string {
  const title = escapeMarkdown(truncateText(product.title, 80));
  const price = escapeMarkdown(formatPrice(product));
  const rating = formatRating(product);
  
  let message = `*${index + 1}\\. ${title}*\n`;
  message += `💰 *Price:* ${price}\n`;
  message += `${rating}\n`;
  
  if (product.snippet) {
    const snippet = escapeMarkdown(truncateText(product.snippet, 150));
    message += `📝 ${snippet}\n`;
  }
  
  if (product.link) {
    message += `🔗 [View on Amazon](${product.link})\n`;
  }
  
  return message;
}

/**
 * Format multiple products into a paginated response with action buttons
 */
export function formatProductList(
  products: ProductResult[], 
  query: string, 
  page: number = 1, 
  itemsPerPage: number = 5
): { message: string; keyboard: any[] } {
  if (products.length === 0) {
    return {
      message: `🔍 No products found for "${escapeMarkdown(query)}"\n\nTry different keywords or check spelling\\.`,
      keyboard: []
    };
  }

  const startIdx = (page - 1) * itemsPerPage;
  const endIdx = Math.min(startIdx + itemsPerPage, products.length);
  const currentProducts = products.slice(startIdx, endIdx);
  
  let message = `🛍️ *Amazon Search Results*\n`;
  message += `🔍 Query: "${escapeMarkdown(query)}"\n`;
  message += `📦 Showing ${startIdx + 1}\\-${endIdx} of ${products.length} products\n\n`;
  
  // Build inline keyboard for all products
  const keyboard: any[] = [];
  
  currentProducts.forEach((product, idx) => {
    const globalIdx = startIdx + idx;
    message += formatSingleProduct(product, globalIdx);
    message += '\n';
    
    // Add action buttons for each product
    const productButtons = createProductActionKeyboard(product, globalIdx);
    if (productButtons.length > 0) {
      keyboard.push(...productButtons);
    }
  });
  
  // Add pagination buttons
  const totalPages = Math.ceil(products.length / itemsPerPage);
  const paginationButtons = createPaginationKeyboard(query, page, totalPages);
  if (paginationButtons.length > 0) {
    keyboard.push(...paginationButtons);
  }
  
  // Add pagination info to message
  if (totalPages > 1) {
    message += `📄 *Page ${page} of ${totalPages}*\n`;
    if (page < totalPages) {
      message += `Use buttons below to navigate or /search ${escapeMarkdown(query)} ${page + 1} for next page\\.`;
    }
  }
  
  return {
    message,
    keyboard
  };
}

/**
 * Format a compact product summary for inline display
 */
export function formatCompactProduct(product: ProductResult): string {
  const title = escapeMarkdown(truncateText(product.title, 50));
  const price = escapeMarkdown(formatPrice(product));
  
  return `${title} \\- ${price}`;
}

/**
 * Format search error message
 */
export function formatSearchError(query: string, error: string): string {
  return `❌ *Search Failed*\n\n` +
         `🔍 Query: "${escapeMarkdown(query)}"\n` +
         `💥 Error: ${escapeMarkdown(error)}\n\n` +
         `Please try again or contact support if the problem persists\\.`;
}

/**
 * Format search loading message
 */
export function formatSearchLoading(query: string): string {
  return `🔍 *Searching Amazon\\.\\.\\.*\n\n` +
         `Query: "${escapeMarkdown(query)}"\n` +
         `⏳ Please wait while we find the best products for you\\.`;
}

/**
 * Format help message for search commands
 */
export function formatSearchHelp(): string {
  return `🔍 *Amazon Search Help*\n\n` +
         `*Basic Search:*\n` +
         `/search wireless headphones\n` +
         `/search laptop under 1000\n\n` +
         `*Advanced Options:*\n` +
         `/search product name \\[page\\]\n` +
         `Example: /search iPhone 15 2\n\n` +
         `*Tips:*\n` +
         `• Be specific with product names\n` +
         `• Include brand names for better results\n` +
         `• Use size, color, or model specifications\n` +
         `• Results are limited to 50 items per search\n\n` +
         `*Next Steps:*\n` +
         `After finding products, you can:\n` +
         `• Copy the Amazon link to purchase\n` +
         `• Use future Crossmint checkout features\n` +
         `• Share products with friends`;
}

/**
 * Create inline keyboard for product pagination
 */
export function createPaginationKeyboard(
  query: string, 
  currentPage: number, 
  totalPages: number
): any[] {
  const keyboard = [];
  
  if (totalPages > 1) {
    const row = [];
    
    if (currentPage > 1) {
      row.push({
        text: '← Previous',
        callback_data: `search:${query}:${currentPage - 1}`
      });
    }
    
    row.push({
      text: `${currentPage}/${totalPages}`,
      callback_data: 'noop'
    });
    
    if (currentPage < totalPages) {
      row.push({
        text: 'Next →',
        callback_data: `search:${query}:${currentPage + 1}`
      });
    }
    
    keyboard.push(row);
  }
  
  return keyboard;
}

/**
 * Format quick action buttons for a product
 */
export function createProductActionKeyboard(product: ProductResult, index: number): any[] {
  const keyboard = [];
  
  const row = [];
  
  if (product.link) {
    row.push({
      text: '🛒 View on Amazon',
      url: product.link
    });
  }
  
  // Add Crossmint purchase button with minimal data (to avoid 64-byte Telegram limit)
  row.push({
    text: '💳 Buy with Crossmint',
    callback_data: `crossmint_buy:${index}`
  });
  
  if (row.length > 0) {
    keyboard.push(row);
  }
  
  return keyboard;
} 