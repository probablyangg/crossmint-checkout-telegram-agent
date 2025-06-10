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

    // For passkey wallets, we might need a different approach
    // Let's try to submit a minimal approval that triggers the WebAuthn flow
    
    const approvalApiUrl = `${CROSSMINT_BASE_URL}/wallets/${walletAddress}/transactions/${transactionId}/approvals`;
    
    // Try submitting without signature first - this might trigger the WebAuthn flow
    const minimalApprovalPayload = {
      approvals: [{
        signer: signerLocator,
        // We'll let Crossmint handle the signature generation
        metadata: {
          userAgent: request.headers.get('user-agent') || 'Crossmint-Bot/1.0',
          origin: request.headers.get('origin') || 'http://localhost:3000'
        }
      }]
    };

    console.log('📦 Minimal approval payload:', JSON.stringify(minimalApprovalPayload, null, 2));

    try {
      const response = await axios.post(
        approvalApiUrl,
        minimalApprovalPayload,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': CROSSMINT_API_KEY,
          },
          timeout: 30000,
        }
      );

      console.log(`✅ Minimal approval submitted: ${response.status}`);
      console.log('📦 Response:', JSON.stringify(response.data, null, 2));

      return NextResponse.json({
        success: true,
        transaction: response.data,
        method: 'minimal-approval'
      });

    } catch (minimalError: any) {
      console.log('❌ Minimal approval failed, trying alternative approach...');
      
      if (minimalError.response) {
        console.log('Error details:', {
          status: minimalError.response.status,
          data: minimalError.response.data
        });
        
        // If the error indicates we need a signature, provide helpful guidance
        if (minimalError.response.status === 400) {
          const errorMessage = minimalError.response.data?.message || '';
          if (errorMessage.includes('signature') || errorMessage.includes('approval')) {
            return NextResponse.json({
              error: 'Transaction approval requires WebAuthn signature. Please ensure your browser supports WebAuthn and try again.',
              needsClientSignature: true,
              signerLocator: signerLocator,
              transactionId: transactionId
            }, { status: 400 });
          }
        }
      }
      
      throw minimalError;
    }

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