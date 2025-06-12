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
      triggerWebauthn
    } = await request.json();

    if (!walletAddress || !transactionId || !signerLocator) {
      return NextResponse.json(
        { error: 'Missing required parameters: walletAddress, transactionId, signerLocator' },
        { status: 400 }
      );
    }

    if (!CROSSMINT_API_KEY) {
      return NextResponse.json(
        { error: 'Missing Crossmint API key' },
        { status: 500 }
      );
    }

    console.log('\n🔐 === SIMPLIFIED TRANSACTION APPROVAL ===');
    console.log(`👛 Wallet: ${walletAddress}`);
    console.log(`📝 Transaction: ${transactionId}`);
    console.log(`🔐 Signer: ${signerLocator}`);
    console.log(`🔄 Trigger WebAuthn: ${triggerWebauthn}`);

    // For passkey wallets, we need to trigger the approval through the Client SDK
    // Instead of trying to manually construct signatures, let's return instructions
    // for the frontend to handle this properly with the SDK
    
    const approvalApiUrl = `${CROSSMINT_BASE_URL}/wallets/${walletAddress}/transactions/${transactionId}/approvals`;
    
    console.log('📋 Cannot directly approve passkey transactions from server side');
    console.log('📋 Passkey transactions require client-side WebAuthn interaction');
    
    // Return information for client-side handling
    return NextResponse.json({
      error: 'Passkey transactions require client-side approval',
      requiresClientSideApproval: true,
      message: 'This transaction uses a passkey signer and must be approved through the Crossmint Client SDK in the browser.',
      instructions: {
        method: 'Use wallet.signMessage() or alternative signing method',
        signerLocator: signerLocator,
        transactionId: transactionId,
        walletAddress: walletAddress
      }
    }, { status: 400 });

  } catch (error: any) {
    console.error('❌ Error in simplified approval:', error);
    
    if (error.response) {
      console.error('❌ API error details:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
      
      return NextResponse.json(
        { error: `Approval failed: ${error.response.data?.message || error.response.statusText}` },
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