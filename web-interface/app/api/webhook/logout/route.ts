import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

interface LogoutData {
  userId: number;
  source?: string; // 'web' or 'bot'
}

const BOT_API_URL = process.env.NEXT_PUBLIC_BOT_API_URL;

export async function POST(request: NextRequest) {
  try {
    const body: LogoutData = await request.json();
    const { userId, source = 'web' } = body;

    if (!userId || typeof userId !== 'number') {
      return NextResponse.json(
        { error: 'Missing or invalid userId' },
        { status: 400 }
      );
    }

    console.log(`🚪 Logout request from ${source} for user ${userId}`);

    // If this is a logout from the web interface, notify the bot
    if (source === 'web' && BOT_API_URL) {
      try {
        // Send logout notification to bot server
        await axios.post(`${BOT_API_URL}/api/logout`, {
          userId,
          source: 'web',
          timestamp: Date.now()
        });
        
        console.log(`✅ Bot notified of web logout for user ${userId}`);
      } catch (error) {
        console.error(`❌ Failed to notify bot of logout for user ${userId}:`, error);
        // Don't fail the logout if bot notification fails
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Logout processed successfully',
      userId,
      source
    });

  } catch (error) {
    console.error('❌ Error processing logout:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 