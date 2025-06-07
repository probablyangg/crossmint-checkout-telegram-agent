/**
 * Crossmint Wallet Management Service
 * Handles wallet creation, authentication, balance checking, and top-ups
 */

import type { 
  WalletUser, 
  WalletBalance, 
  TopUpSession, 
  WalletTransaction
} from '../../types/wallet.js';

import { config as appConfig } from '../../utils/config.js';

// Environment configuration
const config = {
  clientApiKey: process.env.CROSSMINT_CLIENT_API_KEY || '',
  serverApiKey: process.env.CROSSMINT_API_KEY || '', 
  projectId: process.env.CROSSMINT_PROJECT_ID || '',
  environment: process.env.CROSSMINT_ENVIRONMENT || 'staging',
  baseUrl: process.env.CROSSMINT_ENVIRONMENT === 'production' 
    ? 'https://api.crossmint.com' 
    : 'https://staging.crossmint.com',
  webAppUrl: appConfig.webApp.url // Use the properly configured web app URL
};

// Validation schemas (for future use)
// const WalletUserSchema = z.object({
//   userId: z.number(),
//   telegramUsername: z.string().optional(),
//   firstName: z.string().optional(),
//   email: z.string().email().optional(),
//   crossmintUserId: z.string().optional(),
//   walletAddress: z.string().optional(),
//   walletStatus: z.enum(['not_created', 'creating', 'created', 'error']),
//   authToken: z.string().optional(),
//   createdAt: z.number(),
//   lastActivity: z.number()
// });

// In-memory storage (use database in production)
const walletUsers = new Map<number, WalletUser>();
const topUpSessions = new Map<string, TopUpSession>();
const transactions = new Map<string, WalletTransaction>();

class CrossmintWalletService {
  /**
   * Validates that the web app URL is a valid, secure URL
   */
  public isValidWebAppUrl(url?: string): boolean {
    const urlToValidate = url || config.webAppUrl;
    if (!urlToValidate || !urlToValidate.startsWith('https://')) {
      return false;
    }
    
    // For local development, allow localhost URLs
    const isDevelopment = process.env.NODE_ENV === 'development';
    const isLocalhost = urlToValidate.includes('localhost');
    const isNotPlaceholder = !urlToValidate.includes('your-app.vercel.app');
    
    let isValid: boolean;
    if (isDevelopment && isLocalhost) {
      // In development, allow localhost with http or https
      isValid = true;
      console.log(`🧪 Development mode: allowing localhost URL`);
    } else {
      // In production, require HTTPS and no localhost
      isValid = isNotPlaceholder;
    }
    
    console.log(`✅ URL validation result: ${isValid}`);
    console.log(`🧪 URL criteria check: isDev=${isDevelopment}, isLocalhost=${isLocalhost}, not-placeholder=${isNotPlaceholder}`);
    return isValid;
  }

  /**
   * Generate authentication link for user to create/login to wallet
   */
  generateAuthLink(userId: number, userInfo: { username?: string; firstName?: string }): string | null {
    // Create or update user record
    let user = walletUsers.get(userId);
    if (!user) {
      user = {
        userId,
        telegramUsername: userInfo.username || undefined,
        firstName: userInfo.firstName || undefined,
        walletStatus: 'not_created',
        createdAt: Date.now(),
        lastActivity: Date.now()
      };
      walletUsers.set(userId, user);
    } else {
      user.lastActivity = Date.now();
      if (userInfo.username) user.telegramUsername = userInfo.username;
      if (userInfo.firstName) user.firstName = userInfo.firstName;
    }

    // Check if web app URL is valid for Telegram
    if (!this.isValidWebAppUrl()) {
      console.error('Invalid web app URL for Telegram:', config.webAppUrl);
      return null;
    }

    // Generate state parameter for OAuth-like flow
    const state = Buffer.from(JSON.stringify({ 
      userId, 
      timestamp: Date.now(),
      source: 'telegram' 
    })).toString('base64');

    const authUrl = `${config.webAppUrl}/auth?state=${state}&return=telegram`;
    console.log(`🚀 Generated auth URL for user ${userId}: ${authUrl}`);

    // Web app handles Crossmint authentication and returns to Telegram
    return authUrl;
  }

  /**
   * Get user wallet information
   */
  getUser(userId: number): WalletUser | null {
    return walletUsers.get(userId) || null;
  }

  /**
   * Update user after successful authentication
   */
  updateUserAuth(userId: number, authData: { 
    email?: string; 
    crossmintUserId: string; 
    walletAddress: string; 
    authToken: string; 
  }): void {
    let user = walletUsers.get(userId);
    
    // Create user if not exists - critical for handling wallet creation webhooks
    if (!user) {
      console.log(`🔧 Creating new user record for userId ${userId} during wallet update`);
      user = {
        userId,
        walletStatus: 'not_created', // Will be updated below
        createdAt: Date.now(),
        lastActivity: Date.now()
      };
    }
    
    // Update wallet information
    user.email = authData.email || undefined;
    user.crossmintUserId = authData.crossmintUserId;
    user.walletAddress = authData.walletAddress;
    user.authToken = authData.authToken;
    user.walletStatus = 'created';
    user.lastActivity = Date.now();
    
    // Save the updated user
    walletUsers.set(userId, user);
    
    // Debug logging
    console.log(`✅ Wallet updated for user ${userId}: ${user.walletAddress}`);
    console.log(`✅ User now has wallet: ${this.hasWallet(userId)}`);
  }

  /**
   * Check if user has a wallet
   */
  hasWallet(userId: number): boolean {
    const user = this.getUser(userId);
    return user?.walletStatus === 'created' && !!user.walletAddress;
  }

  /**
   * Get wallet balance using Crossmint API
   */
  async getWalletBalance(userId: number): Promise<WalletBalance | null> {
    const user = this.getUser(userId);
    if (!user || !user.walletAddress) {
      console.log(`❌ No wallet found for user ${userId}`);
      return null;
    }

    try {
      // Use Crossmint API to get actual wallet balance
      const walletLocator = user.walletAddress; // Can be wallet address directly
      const apiUrl = `${config.baseUrl}/api/v1-alpha2/wallets/${walletLocator}/balances?tokens=usdc`;
      
      console.log(`🔍 Fetching balance for wallet ${user.walletAddress}`);
      console.log(`📡 API URL: ${apiUrl}`);

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'X-API-KEY': config.serverApiKey,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.error(`❌ Crossmint API error: ${response.status} ${response.statusText}`);
        const errorText = await response.text();
        console.error(`❌ Error details: ${errorText}`);
        return null;
      }

      const balanceData = await response.json();
      console.log(`✅ Balance data received:`, balanceData);

      // Transform Crossmint API response to our format
      const balances = balanceData.map((tokenBalance: any) => ({
        chain: Object.keys(tokenBalance.balances).find(chain => tokenBalance.balances[chain] !== '0') || 'unknown',
        currency: tokenBalance.token.toUpperCase(),
        amount: (parseInt(tokenBalance.balances.total || '0') / Math.pow(10, tokenBalance.decimals)).toFixed(2),
        decimals: tokenBalance.decimals
      }));

      return {
        walletAddress: user.walletAddress,
        balances,
        lastUpdated: Date.now()
      };

    } catch (error) {
      console.error('❌ Error fetching wallet balance:', error);
      return null;
    }
  }

  /**
   * Generate top-up link for adding funds to wallet
   */
  generateTopUpLink(userId: number, amount: number, currency: string = 'USD'): string | null {
    const user = this.getUser(userId);
    if (!user || !user.walletAddress) {
      throw new Error('User wallet not found');
    }

    // Check if web app URL is valid for Telegram
    if (!this.isValidWebAppUrl()) {
      console.error('Invalid web app URL for Telegram:', config.webAppUrl);
      return null;
    }

    // Create top-up session
    const sessionId = `topup_${userId}_${Date.now()}`;
    const session: TopUpSession = {
      userId,
      sessionId,
      amount,
      currency,
      status: 'initiated',
      createdAt: Date.now(),
      expiresAt: Date.now() + (30 * 60 * 1000) // 30 minutes
    };
    topUpSessions.set(sessionId, session);

    // Generate top-up URL (web app handles Crossmint checkout)
    return `${config.webAppUrl}/topup?session=${sessionId}&amount=${amount}&currency=${currency}`;
  }

  /**
   * Get top-up session
   */
  getTopUpSession(sessionId: string): TopUpSession | null {
    return topUpSessions.get(sessionId) || null;
  }

  /**
   * Update top-up session status
   */
  updateTopUpSession(sessionId: string, updates: Partial<TopUpSession>): void {
    const session = topUpSessions.get(sessionId);
    if (session) {
      Object.assign(session, updates);
      topUpSessions.set(sessionId, session);
    }
  }

  /**
   * Create a wallet-based purchase order
   */
  async createWalletPurchase(
    userId: number,
    productInfo: { title: string; amazonUrl: string; price: string },
    paymentDetails: { chain: string; currency: string }
  ): Promise<WalletTransaction> {
    const user = this.getUser(userId);
    if (!user || !user.walletAddress) {
      throw new Error('User wallet not found');
    }

    const transactionId = `tx_${userId}_${Date.now()}`;
    const transaction: WalletTransaction = {
      id: transactionId,
      userId,
      walletAddress: user.walletAddress,
      type: 'purchase',
      amount: productInfo.price,
      currency: paymentDetails.currency,
      chain: paymentDetails.chain,
      status: 'pending',
      productInfo,
      createdAt: Date.now()
    };

    transactions.set(transactionId, transaction);

    // TODO: Call Crossmint headless checkout API with wallet payment
    // This would create the actual order using the user's wallet balance

    return transaction;
  }

  /**
   * Get user transactions
   */
  getUserTransactions(userId: number): WalletTransaction[] {
    return Array.from(transactions.values())
      .filter(tx => tx.userId === userId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Get wallet statistics for admin/debugging
   */
  getStats(): { totalUsers: number; walletsCreated: number; activeSessions: number } {
    const totalUsers = walletUsers.size;
    const walletsCreated = Array.from(walletUsers.values())
      .filter(user => user.walletStatus === 'created').length;
    const activeSessions = topUpSessions.size;

    return { totalUsers, walletsCreated, activeSessions };
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions(): void {
    const now = Date.now();
    for (const [sessionId, session] of topUpSessions.entries()) {
      if (now > session.expiresAt) {
        topUpSessions.delete(sessionId);
      }
    }
  }

  /**
   * Clear user data (logout functionality)
   */
  clearUser(userId: number): boolean {
    const user = walletUsers.get(userId);
    if (!user) {
      return false; // User not found
    }

    // Log the logout
    console.log(`🚪 Logging out user ${userId}: ${user.walletAddress || 'no wallet'}`);

    // Remove user from storage
    walletUsers.delete(userId);

    // Clean up user's topup sessions
    const userSessions = Array.from(topUpSessions.entries())
      .filter(([_, session]) => session.userId === userId);
    
    userSessions.forEach(([sessionId, _]) => {
      topUpSessions.delete(sessionId);
    });

    // Clean up user's transactions
    const userTransactions = Array.from(transactions.entries())
      .filter(([_, transaction]) => transaction.userId === userId);
    
    userTransactions.forEach(([transactionId, _]) => {
      transactions.delete(transactionId);
    });

    console.log(`✅ User ${userId} logged out successfully. Cleaned up ${userSessions.length} sessions and ${userTransactions.length} transactions.`);
    return true;
  }

  /**
   * Check if user is logged in (has valid session)
   */
  isUserLoggedIn(userId: number): boolean {
    const user = walletUsers.get(userId);
    return user?.walletStatus === 'created' && !!user.walletAddress && !!user.authToken;
  }
}

// Export singleton instance
export const crossmintWalletService = new CrossmintWalletService();

// Start cleanup interval
setInterval(() => {
  crossmintWalletService.cleanupExpiredSessions();
}, 5 * 60 * 1000); // Every 5 minutes 