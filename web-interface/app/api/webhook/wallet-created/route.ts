import { NextRequest, NextResponse } from 'next/server';

interface WalletCreatedData {
  userId: number;
  walletAddress: string;
  crossmintUserId: string;
  email?: string;
  authToken: string;
}

export async function POST(request: NextRequest) {
  try {
    const data: WalletCreatedData = await request.json();
    
    console.log('🌐 Web interface received wallet creation request:', {
      userId: data.userId,
      walletAddress: data.walletAddress?.substring(0, 10) + '...',
      crossmintUserId: data.crossmintUserId
    });
    
    // Validate the request data
    if (!data.userId || !data.walletAddress || !data.crossmintUserId || !data.authToken) {
      console.error('❌ Missing required wallet data:', data);
      return NextResponse.json(
        { error: 'Missing required wallet data' },
        { status: 400 }
      );
    }

    // Configure bot URL based on environment
    const BOT_WEBHOOK_URL = process.env.BOT_WEBHOOK_URL || 'http://localhost:3000/api/webhook/wallet-created';
    
    console.log('🤖 Attempting to notify bot at:', BOT_WEBHOOK_URL);

    // Forward to the bot's webhook endpoint
    try {
      const botResponse = await fetch(BOT_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        // Add timeout to prevent hanging
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      if (!botResponse.ok) {
        const errorText = await botResponse.text();
        console.error('❌ Bot notification failed:', {
          status: botResponse.status,
          statusText: botResponse.statusText,
          error: errorText
        });
        
        // Still return success to web interface, but log the issue
        return NextResponse.json({
          success: true,
          message: 'Wallet creation processed (bot notification failed)',
          userId: data.userId,
          walletAddress: data.walletAddress,
          botNotificationStatus: 'failed'
        });
      } else {
        const botResponseData = await botResponse.json();
        console.log('✅ Bot notification successful:', botResponseData);
        
        return NextResponse.json({
          success: true,
          message: 'Wallet creation processed successfully',
          userId: data.userId,
          walletAddress: data.walletAddress,
          botNotificationStatus: 'success'
        });
      }
    } catch (error) {
      console.error('❌ Network error notifying bot:', error);
      
      // Still return success to web interface, but log the issue
      return NextResponse.json({
        success: true,
        message: 'Wallet creation processed (bot notification failed - network error)',
        userId: data.userId,
        walletAddress: data.walletAddress,
        botNotificationStatus: 'network_error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

  } catch (error) {
    console.error('❌ Error processing wallet creation:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Ensure only POST requests are allowed
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
} 