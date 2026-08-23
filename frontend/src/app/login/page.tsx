'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Script from 'next/script';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [isWakingServer, setIsWakingServer] = useState(false);
  const [error, setError] = useState('');
  const { loginWithGoogle, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const googleButtonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (loading || isLoading) {
      timer = setTimeout(() => {
        setIsWakingServer(true);
      }, 4000);
    } else {
      setIsWakingServer(false);
    }
    return () => clearTimeout(timer);
  }, [loading, isLoading]);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push('/');
    }
  }, [isLoading, isAuthenticated, router]);

  const handleGoogleSuccess = async (response: any) => {
    setError('');
    setLoading(true);
    
    try {
      console.log('[Auth] Google login successful. Sending token to backend...');
      const result = await loginWithGoogle(response.credential);
      
      if (result.success) {
        console.log('[Auth] Backend authentication successful');
        router.push('/');
      } else {
        console.error('[Auth] Backend authentication error:', result.error);
        setError(result.error || 'Google login failed');
        setLoading(false);
      }
    } catch (err) {
      console.error('[Auth] Exception during backend authentication:', err);
      setError('An unexpected error occurred during login');
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F5F3EE] p-4 text-center">
        <p className="text-[#707070] text-sm">
          {isWakingServer ? 'Waking up server, this may take up to a minute...' : 'Loading...'}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F3EE] p-4">
      <Script 
        src="https://accounts.google.com/gsi/client" 
        strategy="afterInteractive"
        onLoad={() => {
          if (googleButtonRef.current && window.google) {
            window.google.accounts.id.initialize({
              client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '', // Ensure this is set
              callback: handleGoogleSuccess,
            });
            window.google.accounts.id.renderButton(
              googleButtonRef.current,
              { theme: 'outline', size: 'large', width: '360' }
            );
          }
        }}
      />
      <div className="w-full max-w-[360px] p-8 luxury-card flex flex-col items-center">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-[#C79A3B] rounded-full flex items-center justify-center text-white font-bold text-2xl">CB</div>
          <h1 className="text-2xl font-bold text-[#1C1C1C]">CB RKM</h1>
          <p className="text-[#707070] mt-2">Welcome back to Automation Pro</p>
        </div>
        
        <div ref={googleButtonRef} />

        {loading && (
          <p className="text-[#707070] text-sm mt-4 text-center animate-pulse">
            {isWakingServer
              ? 'Waking up server, this may take up to a minute...'
              : 'Verifying credentials...'}
          </p>
        )}

        {error && <p className="text-red-500 text-sm mt-4 text-center">{error}</p>}
      </div>
    </div>
  );
}
