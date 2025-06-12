import { crossmintWalletService } from './wallet.js';

// Bot signer address - this should match the address in the web interface
const BOT_SIGNER_ADDRESS = "0x9AF659Ef26583C0793c35C52E076FBeA6486E31d";

// API configuration
const config = {
  serverApiKey: process.env.CROSSMINT_API_KEY || '',
  baseUrl: process.env.CROSSMINT_ENVIRONMENT === 'production' 
    ? 'https://api.crossmint.com' 
    : 'https://staging.crossmint.com'
};

interface DelegatedSigner {
  signer: string;
  chains?: Record<string, { status: string }>;
}

/**
 * Service for handling delegation status and auto-signing functionality
 */
export class CrossmintDelegationService {
  
  /**
   * Check if a user has delegated signing authority to the bot
   * This uses the Crossmint REST API to check delegated signers
   */
  async isDelegatedToBotSigner(userId: number): Promise<boolean> {
    try {
      console.log(`\n🔍 === DELEGATION CHECK DEBUG START ===`);
      console.log(`👤 User ID: ${userId}`);
      
      const user = crossmintWalletService.getUser(userId);
      if (!user || !user.walletAddress) {
        console.log(`❌ User ${userId} has no wallet - cannot check delegation`);
        console.log(`📊 User data:`, user);
        console.log(`=== DELEGATION CHECK DEBUG END ===\n`);
        return false;
      }

      console.log(`✅ User wallet found: ${user.walletAddress}`);
      console.log(`🔍 Checking delegation status for user ${userId} (${user.walletAddress})`);
      
      // Check if we have the required environment variables
      if (!config.serverApiKey) {
        console.log(`⚠️ Crossmint API key not configured - cannot check delegation`);
        console.log(`🔧 Environment check: CROSSMINT_API_KEY = ${config.serverApiKey ? '[SET]' : '[NOT SET]'}`);
        console.log(`=== DELEGATION CHECK DEBUG END ===\n`);
        return false;
      }

      console.log(`✅ API key configured: ${config.serverApiKey.substring(0, 10)}...`);
      console.log(`🤖 Bot signer address: ${BOT_SIGNER_ADDRESS}`);
      
      // Call Crossmint REST API to get all delegated signers for this wallet
      const apiUrl = `${config.baseUrl}/api/2022-06-09/wallets/${user.walletAddress}/signers`;
      console.log(`🔗 API URL: ${apiUrl}`);
      console.log(`📡 Making API request to list all delegated signers...`);
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'X-API-KEY': config.serverApiKey,
          'Content-Type': 'application/json',
        },
      });

      console.log(`📈 API Response Status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        console.error(`❌ Error checking delegated signers: ${response.status} ${response.statusText}`);
        try {
          const errorText = await response.text();
          console.error(`❌ Error response body:`, errorText);
        } catch (e) {
          console.error(`❌ Could not read error response body`);
        }
        console.log(`=== DELEGATION CHECK DEBUG END ===\n`);
        return false;
      }

      const delegatedSigners: DelegatedSigner[] = await response.json();
      console.log(`📋 Delegated signers received:`, JSON.stringify(delegatedSigners, null, 2));
      console.log(`📊 Number of delegated signers: ${delegatedSigners.length}`);

      // Check if bot signer is in the list
      const isBotDelegated = delegatedSigners.some((signer: DelegatedSigner) => 
        signer.signer.toLowerCase() === BOT_SIGNER_ADDRESS.toLowerCase()
      );

      if (isBotDelegated) {
        console.log(`✅ Bot signer ${BOT_SIGNER_ADDRESS} is successfully delegated for user ${userId}`);
        console.log(`🎉 DELEGATION IS ACTIVE - AUTO-SIGNING SHOULD WORK!`);
        console.log(`=== DELEGATION CHECK DEBUG END ===\n`);
        return true;
      } else {
        console.log(`❌ Bot signer ${BOT_SIGNER_ADDRESS} is not delegated for user ${userId}`);
        console.log(`💡 Available signers:`, delegatedSigners.map((s: DelegatedSigner) => s.signer));
        console.log(`=== DELEGATION CHECK DEBUG END ===\n`);
        return false;
      }
      
    } catch (error) {
      console.error(`❌ Error checking delegation for user ${userId}:`, error);
      console.error(`❌ Error details:`, {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      console.log(`=== DELEGATION CHECK DEBUG END ===\n`);
      return false;
    }
  }

  /**
   * Get the bot signer address
   */
  getBotSignerAddress(): string {
    return BOT_SIGNER_ADDRESS;
  }

  /**
   * Check if auto-signing is available for a user
   * This combines delegation check with system readiness
   */
  async canAutoSign(userId: number): Promise<boolean> {
    try {
      console.log(`\n🔍 === CAN AUTO-SIGN CHECK ===`);
      console.log(`👤 User ID: ${userId}`);

      // Check if user has a wallet
      const hasWallet = crossmintWalletService.hasWallet(userId);
      if (!hasWallet) {
        console.log(`❌ User ${userId} has no wallet`);
        console.log(`=== CAN AUTO-SIGN CHECK END ===\n`);
        return false;
      }

      // Check if bot signer is delegated
      const isDelegated = await this.isDelegatedToBotSigner(userId);
      console.log(`🔗 Delegation status: ${isDelegated}`);
      console.log(`=== CAN AUTO-SIGN CHECK END ===\n`);
      
      return isDelegated;
    } catch (error) {
      console.error(`❌ Error checking auto-sign availability for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Sign a transaction with the bot signer (placeholder implementation)
   * TODO: Implement actual signing logic with bot's private key
   */
  async signTransactionWithBotSigner(
    walletAddress: string, 
    serializedTransaction: string, 
    chain: string
  ): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    try {
      console.log(`🤖 === BOT SIGNING ATTEMPT ===`);
      console.log(`💰 Wallet: ${walletAddress}`);
      console.log(`⛓️ Chain: ${chain}`);
      console.log(`📝 Transaction preview: ${serializedTransaction.substring(0, 50)}...`);
      
      // TODO: Implement actual bot signing logic here
      // For now, return failure to fall back to manual approval
      console.log(`⚠️ Bot signing not yet implemented - falling back to manual approval`);
      console.log(`=== BOT SIGNING ATTEMPT END ===\n`);
      
      return {
        success: false,
        error: 'Bot signing not yet implemented'
      };
    } catch (error) {
      console.error(`❌ Error in bot signing:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Log delegation attempt for monitoring
   */
  logDelegationAttempt(userId: number, success: boolean, error?: string): void {
    const timestamp = new Date().toISOString();
    if (success) {
      console.log(`✅ [${timestamp}] Delegation successful for user ${userId}`);
    } else {
      console.log(`❌ [${timestamp}] Delegation failed for user ${userId}: ${error || 'Unknown error'}`);
    }
  }
}

/**
 * Export singleton instance
 */
export const crossmintDelegationService = new CrossmintDelegationService(); 