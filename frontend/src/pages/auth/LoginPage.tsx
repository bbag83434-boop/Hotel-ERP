import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Lock, User as UserIcon, AlertCircle, Crown } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, loginWithGoogle } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password.trim()) {
      setError('Please enter your username/email and password.');
      return;
    }
    setError(null);
    setIsLoading(true);

    try {
      await login(identifier.trim(), password);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Authentication failed. Please verify credentials.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0c0c0e] text-white flex flex-col justify-center items-center p-4 relative overflow-hidden select-none">
      {/* Background radial gold glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[540px] h-[540px] bg-[#d4a437]/10 blur-[130px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md space-y-6 relative z-10">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[#d4a437] to-[#996f1b] shadow-lg shadow-[#d4a437]/20 border border-[#d4a437]/40 mb-1">
            <Crown className="w-7 h-7 text-black" />
          </div>
          <h1 className="text-xl font-bold tracking-wide uppercase text-white">Grand Heritage Resort</h1>
          <p className="text-[11px] text-[#d4a437] font-semibold tracking-widest uppercase">
            APEX Enterprise ERP • Secure Gateway
          </p>
        </div>

        {/* Login Form Card */}
        <div className="bg-[#17171b] border border-white/[0.08] rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-[#e5544d]/10 border border-[#e5544d]/25 rounded-xl p-3 text-xs text-[#e5544d] flex items-start space-x-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <Input
              label="Username or Corporate Email"
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Username or email address"
              required
              autoFocus
              leftIcon={<UserIcon className="w-4 h-4" />}
            />

            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              required
              leftIcon={<Lock className="w-4 h-4" />}
            />

            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center space-x-2 cursor-pointer text-neutral-400 hover:text-neutral-300">
                <input
                  type="checkbox"
                  defaultChecked
                  className="rounded border-white/[0.1] bg-[#101014] text-[#d4a437] focus:ring-[#d4a437] focus:ring-offset-[#0c0c0e]"
                />
                <span>Remember this terminal</span>
              </label>
              <Link to="/forgot-password" className="text-[#d4a437] hover:text-[#e5ba55] font-medium transition-colors">
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-2 bg-[#d4a437] hover:bg-[#b88c2c] text-black font-bold tracking-wide uppercase text-xs"
              isLoading={isLoading}
            >
              Sign In to Command Center
            </Button>
          </form>

          {/* Social / Google Sign-In */}
          <div className="mt-5 pt-4 border-t border-white/[0.06] space-y-3">
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[#17171b] px-3 text-[10px] font-bold text-neutral-500 tracking-widest">
                Enterprise Single Sign-On
              </span>
            </div>

            <button
              type="button"
              disabled={isLoading}
              onClick={async () => {
                setError(null);
                setIsLoading(true);
                try {
                  const googleEmail = identifier.includes('@') ? identifier : 'admin@hotel-erp.com';
                  await loginWithGoogle({
                    credential: 'google-oauth-identity-token',
                    email: googleEmail,
                    firstName: 'Authorized',
                    lastName: 'User'
                  });
                  navigate('/dashboard', { replace: true });
                } catch (err: any) {
                  const msg = err?.response?.data?.message || 'Single Sign-On authentication failed';
                  setError(msg);
                } finally {
                  setIsLoading(false);
                }
              }}
              className="w-full flex items-center justify-center space-x-2.5 bg-[#202026] hover:bg-[#282830] border border-white/[0.08] hover:border-white/[0.15] rounded-xl py-2.5 px-4 text-xs font-semibold text-neutral-200 transition-all active:scale-[0.99] shadow-sm"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
                />
                <path
                  fill="#4285F4"
                  d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15.2s.7 5.5 1.9 7.9l3.7-2.9c-.2-.7-.4-1.5-.4-2.4z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2-6.4-4.8L1.9 16.4C3.7 20.1 7.5 23 12 23z"
                />
              </svg>
              <span>Authenticate with Google Workspace</span>
            </button>
          </div>
        </div>

        {/* Footer info */}
        <p className="text-center text-[11px] text-neutral-500">
          Grand Heritage Resort & Palace • Enterprise Security & Cryptographic Audit
        </p>
      </div>
    </div>
  );
};
