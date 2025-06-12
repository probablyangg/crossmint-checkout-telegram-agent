import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const CROSSMINT_API_KEY = process.env.CROSSMINT_API_KEY;
const CROSSMINT_BASE_URL = 'https://staging.crossmint.com/api/2022-06-09';

/**
 * Convert hex string to decimal string for Crossmint API
 */
function hexToDecimalString(hex: string): string {
  // Remove 0x prefix if present
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  // Convert hex to BigInt, then to decimal string
  return BigInt('0x' + cleanHex).toString();
}

/**
 * Ensure signature components are in the correct decimal string format
 */
function formatSignatureForCrossmint(signature: any): { r: string; s: string } {
  console.log('🔄 Original signature format:', signature);
  
  // Handle different signature formats
  if (signature.raw) {
    // For raw signatures, we need to understand the format first
    console.log('📋 Raw signature detected, attempting to parse...');
    const rawSig = signature.raw;
    
    if (typeof rawSig === 'string' && rawSig.startsWith('0x') && rawSig.length === 132) {
      // Standard ECDSA format
      const r = hexToDecimalString('0x' + rawSig.slice(2, 66));
      const s = hexToDecimalString('0x' + rawSig.slice(66, 130));
      console.log('✅ Parsed ECDSA signature from raw format:', { r, s });
      return { r, s };
    } else {
      // For other formats, we might need different handling
      throw new Error(`Unsupported raw signature format: ${rawSig}`);
    }
  }
  
  // Handle standard r,s format
  if (signature.r && signature.s) {
    let r: string, s: string;
    
    if (typeof signature.r === 'string') {
      r = signature.r.startsWith('0x') ? hexToDecimalString(signature.r) : signature.r;
    } else {
      r = signature.r.toString();
    }
    
    if (typeof signature.s === 'string') {
      s = signature.s.startsWith('0x') ? hexToDecimalString(signature.s) : signature.s;
    } else {
      s = signature.s.toString();
    }
    
    console.log('✅ Converted signature to decimal format:', { r, s });
    return { r, s };
  }
  
  // Handle passkey/WebAuthn signatures (they might have different structure)
  if (signature.authenticatorData || signature.clientDataJSON) {
    console.log('📋 WebAuthn/Passkey signature detected');
    // For passkey signatures, the structure is different
    // We might need to handle this case differently
    throw new Error('WebAuthn signatures require different handling - not yet implemented');
  }
  
  throw new Error(`Unknown signature format: ${JSON.stringify(signature)}`);
}

export async function POST(request: NextRequest) {
  try {
    const { 
      walletAddress, 
      transactionId, 
      signerLocator, 
      signature, 
      metadata,
      usePasskeyFlow 
    } = await request.json();

    if (!walletAddress || !transactionId || !signerLocator) {
      return NextResponse.json(
        { error: 'Missing required approval parameters: walletAddress, transactionId, signerLocator' },
        { status: 400 }
      );
    }

    // For passkey flows, signature might be null (client-side approval only)
    if (!usePasskeyFlow && (!signature || !metadata)) {
      return NextResponse.json(
        { error: 'Missing signature or metadata for non-passkey approval' },
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
    
    // Convert signature to proper decimal string format
    const formattedSignature = formatSignatureForCrossmint(signature);
    
    // Construct the approval payload according to Crossmint API docs
    const approvalPayload = {
      approvals: [{
        signer: signerLocator,
        signature: {
          r: formattedSignature.r,
          s: formattedSignature.s
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

    console.log('📦 Approval payload with decimal signatures:', JSON.stringify(approvalPayload, null, 2));

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