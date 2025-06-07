import axios, { AxiosResponse } from 'axios';
import { z } from 'zod';

// Environment validation
const envSchema = z.object({
  SEARCHAPI_KEY: z.string().min(1, 'SearchAPI.io API key is required'),
});

// Validate environment variables on import
const env = envSchema.parse({
  SEARCHAPI_KEY: process.env.SEARCHAPI_KEY,
});

// SearchAPI.io Response Schemas
const SearchMetadataSchema = z.object({
  id: z.string(),
  status: z.string(),
  created_at: z.string(),
  request_time_taken: z.number(),
  total_time_taken: z.number(),
});

const ProductResultSchema = z.object({
  position: z.number(),
  title: z.string(),
  link: z.string(),
  source: z.string().optional(),
  domain: z.string().optional(),
  displayed_link: z.string().optional(),
  snippet: z.string().optional(),
  price: z.string().optional(),
  extracted_price: z.number().optional(),
  rating: z.number().optional(),
  reviews: z.number().optional(),
  thumbnail: z.string().optional(),
  image: z.string().optional(),
});

const SearchResponseSchema = z.object({
  search_metadata: SearchMetadataSchema,
  search_parameters: z.object({
    engine: z.string(),
    q: z.string(),
    device: z.string().optional(),
  }),
  organic_results: z.array(ProductResultSchema).optional(),
  shopping_results: z.array(ProductResultSchema).optional(),
  inline_shopping: z.array(ProductResultSchema).optional(),
  knowledge_graph: z.object({
    title: z.string().optional(),
    price: z.string().optional(),
    rating: z.number().optional(),
    reviews: z.number().optional(),
  }).optional(),
});

// Internal Types
export type SearchAPIResponse = z.infer<typeof SearchResponseSchema>;
export type ProductResult = z.infer<typeof ProductResultSchema>;

export interface SearchAPIOptions {
  engine?: 'amazon' | 'google';
  location?: string;
  device?: 'desktop' | 'mobile' | 'tablet';
  num?: number; // Number of results (max 50)
  page?: number; // Page number for pagination
}

export interface RateLimitInfo {
  requestsPerSecond: number;
  lastRequestTime: number;
  requestCount: number;
}

// Rate limiting configuration
const RATE_LIMITS = {
  requestsPerSecond: 10, // Conservative limit
  windowMs: 1000, // 1 second window
};

class SearchAPIService {
  private baseURL = 'https://www.searchapi.io/api/v1';
  private rateLimitInfo: RateLimitInfo = {
    requestsPerSecond: 0,
    lastRequestTime: 0,
    requestCount: 0,
  };

  /**
   * Rate limiting implementation
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeDiff = now - this.rateLimitInfo.lastRequestTime;

    // Reset counter if more than 1 second has passed
    if (timeDiff >= RATE_LIMITS.windowMs) {
      this.rateLimitInfo.requestCount = 0;
      this.rateLimitInfo.lastRequestTime = now;
    }

    // Check if we've exceeded rate limit
    if (this.rateLimitInfo.requestCount >= RATE_LIMITS.requestsPerSecond) {
      const waitTime = RATE_LIMITS.windowMs - timeDiff;
      if (waitTime > 0) {
        console.log(`Rate limit reached. Waiting ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        this.rateLimitInfo.requestCount = 0;
        this.rateLimitInfo.lastRequestTime = Date.now();
      }
    }

    this.rateLimitInfo.requestCount++;
  }

  /**
   * Search Amazon products using SearchAPI.io
   */
  async searchAmazonProducts(
    query: string, 
    options: SearchAPIOptions = {}
  ): Promise<ProductResult[]> {
    try {
      await this.enforceRateLimit();

      const searchParams = {
        engine: 'amazon_search',
        q: query.trim(),
        api_key: env.SEARCHAPI_KEY,
        device: options.device || 'desktop',
        location: options.location || 'United States',
        num: Math.min(options.num || 20, 50), // Max 50 per SearchAPI docs
        page: options.page || 1,
      };

      console.log(`🔍 Searching Amazon for: "${query}"`);
      console.log(`📍 Location: ${searchParams.location}`);
      console.log(`📱 Device: ${searchParams.device}`);

      const response: AxiosResponse = await axios.get(`${this.baseURL}/search`, {
        params: searchParams,
        timeout: 30000, // 30 second timeout
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Crossmint-Telegram-Bot/1.0',
        },
      });

      // Validate response structure
      const validatedResponse = SearchResponseSchema.parse(response.data);
      
      // Extract products from different result types
      const products: ProductResult[] = [
        ...(validatedResponse.organic_results || []),
        ...(validatedResponse.shopping_results || []),
        ...(validatedResponse.inline_shopping || []),
      ];

      // Add knowledge graph result if it exists
      if (validatedResponse.knowledge_graph?.title) {
        const kgProduct: ProductResult = {
          position: 0,
          title: validatedResponse.knowledge_graph.title,
          link: '', // Knowledge graph might not have direct purchase link
          price: validatedResponse.knowledge_graph.price,
          rating: validatedResponse.knowledge_graph.rating,
          reviews: validatedResponse.knowledge_graph.reviews,
        };
        products.unshift(kgProduct);
      }

      console.log(`✅ Found ${products.length} products for "${query}"`);
      return products;

    } catch (error) {
      console.error('❌ SearchAPI.io Error:', error);
      
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 429) {
          throw new Error('Rate limit exceeded. Please try again later.');
        }
        if (status === 401) {
          throw new Error('Invalid SearchAPI.io API key. Please check your configuration.');
        }
        if (status && status >= 500) {
          throw new Error('SearchAPI.io service is temporarily unavailable.');
        }
        throw new Error(`Search request failed: ${error.response?.statusText || error.message}`);
      }
      
      if (error instanceof z.ZodError) {
        console.error('Response validation error:', error.errors);
        throw new Error('Invalid response format from search service.');
      }
      
      throw new Error('An unexpected error occurred during product search.');
    }
  }

  /**
   * Search with retry logic for improved reliability
   */
  async searchWithRetry(
    query: string, 
    options: SearchAPIOptions = {},
    maxRetries = 3
  ): Promise<ProductResult[]> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.searchAmazonProducts(query, options);
             } catch (error) {
         lastError = error as Error;
         console.warn(`Attempt ${attempt}/${maxRetries} failed:`, error);
         
         // Don't retry on authentication or validation errors
         if (error instanceof Error) {
           if (error.message.includes('Invalid') || error.message.includes('API key')) {
             throw error;
           }
         }
        
        // Wait before retrying (exponential backoff)
        if (attempt < maxRetries) {
          const waitTime = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
          console.log(`⏳ Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    throw lastError!;
  }

  /**
   * Get current rate limit status
   */
  getRateLimitStatus(): RateLimitInfo {
    return { ...this.rateLimitInfo };
  }

  /**
   * Health check for the service
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.enforceRateLimit();
      
      const response = await axios.get(`${this.baseURL}/search`, {
        params: {
          engine: 'amazon',
          q: 'test',
          api_key: env.SEARCHAPI_KEY,
          num: 1,
        },
        timeout: 10000,
      });
      
      return response.status === 200;
    } catch (error) {
      console.error('SearchAPI.io health check failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const searchAPIService = new SearchAPIService(); 