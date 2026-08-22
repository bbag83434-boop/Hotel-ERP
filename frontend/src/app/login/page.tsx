'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { loginWithGoogle, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push('/');
    }
  }, [isLoading, isAuthenticated, router]);

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    
    // NOTE: This triggers the backend stub. In a real implementation, 
    // this would be replaced by the Google Identity Services SDK token.
    // The backend currently expects any token > 5 chars.
    const realGoogleIdToken = 'fixed-token-longer-than-5-chars'; 
    const result = await loginWithGoogle(realGoogleIdToken);
    
    if (result.success) {
      router.push('/');
    } else {
      setError(result.error || 'Google login failed');
      setLoading(false);
    }
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#F5F3EE]">Loading...</div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F3EE] p-4">
      <div className="w-full max-w-[360px] p-8 luxury-card flex flex-col items-center">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-[#C79A3B] rounded-full flex items-center justify-center text-white font-bold text-2xl">CB</div>
          <h1 className="text-2xl font-bold text-[#1C1C1C]">CB RKM</h1>
          <p className="text-[#707070] mt-2">Welcome back to Automation Pro</p>
        </div>
        
        <button 
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full py-3 rounded-lg gold-gradient-bg font-semibold hover:opacity-90 transition-opacity"
        >
          {loading ? 'Authenticating...' : 'Continue with Google'}
        </button>
        {error && <p className="text-red-500 text-sm mt-4">{error}</p>}
      </div>
    </div>
  );
}
