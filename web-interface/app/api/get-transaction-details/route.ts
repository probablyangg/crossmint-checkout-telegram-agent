import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const CROSSMINT_API_KEY = process.env.CROSSMINT_API_KEY;
const CROSSMINT_BASE_URL = 'https://staging.crossmint.com/api/2022-06-09';

export async function POST(request: NextRequest) {
  try {
    const { walletAddress, transactionId } = await request.json();

    if (!walletAddress || !transactionId) {
      return NextResponse.json(
        { error: 'Missing walletAddress or transactionId' },
        { status: 400 }
      );
    }

    if (!CROSSMINT_API_KEY) {
      return NextResponse.json(
        { error: 'Missing Crossmint API key' },
        { status: 500 }
      );
    }

    console.log('\n🔍 === FETCHING TRANSACTION DETAILS ===');
    console.log(`👛 Wallet: ${walletAddress}`);
    console.log(`📝 Transaction: ${transactionId}`);

    const walletApiUrl = `${CROSSMINT_BASE_URL}/wallets/${walletAddress}/transactions/${transactionId}`;
    
    const response = await axios.get(walletApiUrl, {
      headers: {
        'x-api-key': CROSSMINT_API_KEY,
      },
      timeout: 15000,
    });

    console.log(`✅ Transaction details fetched: ${response.status}`);
    console.log('📦 Response:', JSON.stringify(response.data, null, 2));

    const transactionData = response.data;
    
    // Extract pending approval information
    if (transactionData.status === 'awaiting-approval' && 
        transactionData.approvals && 
        transactionData.approvals.pending && 
        transactionData.approvals.pending.length > 0) {
      
      const pendingApproval = transactionData.approvals.pending[0];
      const pendingMessage = pendingApproval.message;
      const signerLocator = pendingApproval.signer;
      
      console.log(`✅ Found pending approval:`);
      console.log(`   📝 Message: ${pendingMessage}`);
      console.log(`   🔐 Signer: ${signerLocator}`);
      
      return NextResponse.json({
        transaction: transactionData,
        pendingMessage: pendingMessage,
        signerLocator: signerLocator
      });
    } else {
      console.log(`⚠️ No pending approvals found. Status: ${transactionData.status}`);
      return NextResponse.json({
        transaction: transactionData,
        error: `Transaction is not awaiting approval. Current status: ${transactionData.status}`
      });
    }

  } catch (error: any) {
    console.error('❌ Error fetching transaction details:', error);
    
    if (error.response) {
      console.error('❌ API error details:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
      
      return NextResponse.json(
        { error: `Failed to fetch transaction: ${error.response.data?.message || error.response.statusText}` },
        { status: error.response.status }
      );
    } else {
      return NextResponse.json(
        { error: `Network error: ${error.message}` },
        { status: 500 }
      );
    }
  }
} 