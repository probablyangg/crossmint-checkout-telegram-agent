import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const CROSSMINT_API_KEY = process.env.CROSSMINT_API_KEY;
const CROSSMINT_BASE_URL = 'https://staging.crossmint.com/api/2022-06-09';

export async function POST(request: NextRequest) {
  try {
    const { 
      walletAddress, 
      transactionId, 
      signerLocator, 
      signature, 
      metadata 
    } = await request.json();

    if (!walletAddress || !transactionId || !signerLocator || !signature || !metadata) {
      return NextResponse.json(
        { error: 'Missing required approval parameters' },
        { status: 400 }
      );
    }

    if (!CROSSMINT_API_KEY) {
      return NextResponse.json(
        { error: 'Missing Crossmint API key' },
        { status: 500 }
      );
    }

    console.log('\n🔐 === SUBMITTING TRANSACTION APPROVAL ===');
    console.log(`👛 Wallet: ${walletAddress}`);
    console.log(`📝 Transaction: ${transactionId}`);
    console.log(`🔐 Signer: ${signerLocator}`);

    const approvalApiUrl = `${CROSSMINT_BASE_URL}/wallets/${walletAddress}/transactions/${transactionId}/approvals`;
    
    // Construct the approval payload according to Crossmint API docs
    const approvalPayload = {
      approvals: [{
        signer: signerLocator,
        signature: {
          r: signature.r,
          s: signature.s
        },
        metadata: {
          authenticatorData: metadata.authenticatorData,
          challengeIndex: metadata.challengeIndex,
          clientDataJSON: metadata.clientDataJSON,
          typeIndex: metadata.typeIndex,
          userVerificationRequired: metadata.userVerificationRequired
        }
      }]
    };

    console.log('📦 Approval payload:', JSON.stringify(approvalPayload, null, 2));

    const response = await axios.post(
      approvalApiUrl,
      approvalPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': CROSSMINT_API_KEY,
        },
        timeout: 30000,
      }
    );

    console.log(`✅ Approval submitted: ${response.status}`);
    console.log('📦 Response:', JSON.stringify(response.data, null, 2));

    if (response.status === 201) {
      return NextResponse.json({
        success: true,
        transaction: response.data
      });
    } else {
      return NextResponse.json(
        { error: `Approval failed with status: ${response.status}` },
        { status: response.status }
      );
    }

  } catch (error: any) {
    console.error('❌ Error submitting approval:', error);
    
    if (error.response) {
      console.error('❌ Approval submission error details:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
      
      return NextResponse.json(
        { error: `Approval submission failed: ${error.response.data?.message || error.response.statusText}` },
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