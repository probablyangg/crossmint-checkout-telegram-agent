/**
 * Wallet integration types for Crossmint
 */

export interface WalletUser {
  userId: number; // Telegram user ID
  telegramUsername?: string | undefined;
  firstName?: string | undefined;
  email?: string | undefined;
  crossmintUserId?: string | undefined;
  walletAddress?: string | undefined;
  walletStatus: 'not_created' | 'creating' | 'created' | 'error';
  authToken?: string | undefined; // JWT from Crossmint
  createdAt: number;
  lastActivity: number;
}

export interface WalletBalance {
  walletAddress: string;
  balances: Array<{
    chain: string;
    currency: string;
    amount: string;
    decimals: number;
  }>;
  lastUpdated: number;
}

export interface TopUpSession {
  userId: number;
  sessionId: string;
  amount: number;
  currency: string;
  status: 'initiated' | 'pending' | 'completed' | 'failed' | 'expired';
  crossmintOrderId?: string;
  createdAt: number;
  expiresAt: number;
}

export interface WalletTransaction {
  id: string;
  userId: number;
  walletAddress: string;
  type: 'top_up' | 'purchase' | 'transfer';
  amount: string;
  currency: string;
  chain: string;
  status: 'pending' | 'completed' | 'failed';
  transactionHash?: string;
  crossmintOrderId?: string;
  productInfo?: {
    title: string;
    amazonUrl: string;
    price: string;
  };
  createdAt: number;
}

export interface CrossmintWalletResponse {
  id: string;
  address: string;
  chain: string;
  type: 'evm-smart-wallet';
  linkedUser: string;
}

export interface CrossmintAuthResponse {
  jwt: string;
  user: {
    id: string;
    email?: string;
  };
}

export interface CrossmintBalanceResponse {
  address: string;
  chain: string;
  tokens: Array<{
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    balance: string;
    balanceUsd?: string;
  }>;
}

export interface CrossmintTopUpOrder {
  orderId: string;
  status: 'pending' | 'completed' | 'failed';
  amount: string;
  currency: string;
  paymentUrl?: string;
  expiresAt: string;
} 