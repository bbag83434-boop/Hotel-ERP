'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, loginWithGoogle, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push('/');
    }
  }, [isLoading, isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    const result = await login(email, password);
    
    if (result.success) {
      router.push('/');
    } else {
      setError(result.error || 'Login failed');
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    // In a real implementation, you would use the Google Identity Services SDK here.
    // For now, this triggers the flow with a placeholder to demonstrate integration.
    const mockIdToken = 'mock-google-id-token'; 
    const result = await loginWithGoogle(mockIdToken);
    
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
      <div className="w-full max-w-[400px] p-8 luxury-card">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold gold-gradient-text">CB RKM</h1>
          <p className="text-[#707070] mt-2">Welcome back to Automation Pro</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 rounded-lg border border-[#2D2D2D]/10 focus:outline-none focus:border-[#C79A3B]"
              required 
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 rounded-lg border border-[#2D2D2D]/10 focus:outline-none focus:border-[#C79A3B]"
              required 
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-3 rounded-lg gold-gradient-bg font-semibold hover:opacity-90 transition-opacity"
          >
            {loading ? 'Logging in...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#2D2D2D]/10"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-[#F5F3EE] text-[#707070]">Or continue with</span>
            </div>
          </div>
          <button 
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full mt-4 py-3 rounded-lg border border-[#2D2D2D]/10 font-semibold hover:bg-[#F1E4C5]/20 transition-colors"
          >
            Google
          </button>
        </div>
      </div>
    </div>
  );
}
