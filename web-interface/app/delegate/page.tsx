"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useWallet } from "@crossmint/client-sdk-react-ui";
import { DelegationComponent } from "@/components/delegation";

// Main Delegation Component (separated to wrap in Suspense)
function DelegationPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { wallet, status: walletStatus } = useWallet();
  
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userId = searchParams.get("userId");
  const isLoading = walletStatus === "in-progress";
  const isLoggedIn = wallet != null && walletStatus === "loaded";

  // Handle hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-redirect after successful delegation
  useEffect(() => {
    if (mounted && typeof window !== 'undefined') {
      const timer = setTimeout(() => {
        // Check if delegation was successful by looking for success state
        const isDelegated = document.querySelector('[data-delegation-success]');
        if (isDelegated) {
          window.close();
        }
      }, 3000); // Auto-close after 3 seconds

      return () => clearTimeout(timer);
    }
  }, [mounted]);

  // Validate user ID parameter
  useEffect(() => {
    if (mounted && !userId) {
      setError("Missing user ID parameter");
    }
  }, [mounted, userId]);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl border shadow-sm p-6 max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-red-800 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.close()}
            className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
          >
            Close Window
          </button>
        </div>
      </div>
    );
  }

  // Show loading while wallet is loading
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-xl border shadow-sm p-6 max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-lg font-semibold mb-2">Loading Wallet...</h2>
          <p className="text-gray-600">Please wait while we connect to your wallet.</p>
        </div>
      </div>
    );
  }

  // Show login prompt if not authenticated
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl border shadow-sm p-6 max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold mb-2">Wallet Required</h2>
          <p className="text-gray-600 mb-4">
            Please connect your wallet to set up delegation.
          </p>
          <p className="text-sm text-gray-500">
            Return to Telegram and try the /login command first.
          </p>
        </div>
      </div>
    );
  }

  // Main delegation interface
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Bot Delegation</h1>
          <p className="text-gray-600">
            Enable fast shopping with automatic transaction signing
          </p>
        </div>
        
        <DelegationComponent />
        
        <div className="mt-6 text-center">
          <button
            onClick={() => window.close()}
            className="text-gray-500 hover:text-gray-700 text-sm"
          >
            Cancel and close window
          </button>
        </div>
      </div>
    </div>
  );
}

// Loading fallback component
function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );
}

// Main component export with Suspense boundary
export default function DelegatePage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <DelegationPageContent />
    </Suspense>
  );
} 