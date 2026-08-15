import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Mail, ArrowLeft, CheckCircle2, Crown } from 'lucide-react';

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setSubmitted(true);
    }, 600);
  };

  return (
    <div className="min-h-screen bg-[#0c0c0e] text-white flex flex-col justify-center items-center p-4 relative overflow-hidden select-none">
      {/* Background radial gold glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#d4a437]/10 blur-[130px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md space-y-6 relative z-10">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-[#d4a437] to-[#996f1b] shadow-lg shadow-[#d4a437]/20 border border-[#d4a437]/40 mb-1">
            <Crown className="w-6 h-6 text-black" />
          </div>
          <h1 className="text-lg font-bold tracking-wide uppercase text-white">Grand Heritage Resort</h1>
          <p className="text-[10px] text-[#d4a437] font-semibold tracking-widest uppercase">
            Security & Identity Recovery
          </p>
        </div>

        <div className="bg-[#17171b] border border-white/[0.08] rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          {!submitted ? (
            <>
              <h2 className="text-lg font-bold text-white mb-1.5">Reset your access credentials</h2>
              <p className="text-xs text-neutral-400 mb-6">
                Enter your registered corporate email address and we will dispatch a cryptographically verified security recovery link.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label="Corporate Email Address"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@grandheritage.com"
                  required
                  autoFocus
                  leftIcon={<Mail className="w-4 h-4" />}
                />
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full bg-[#d4a437] hover:bg-[#b88c2c] text-black font-bold tracking-wide uppercase text-xs"
                  isLoading={isLoading}
                >
                  Dispatch Security Recovery Link
                </Button>
              </form>
            </>
          ) : (
            <div className="text-center py-4 space-y-3">
              <div className="w-12 h-12 bg-[#3fbf6f]/15 text-[#3fbf6f] rounded-2xl flex items-center justify-center mx-auto border border-[#3fbf6f]/30">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">Recovery Link Dispatched</h3>
              <p className="text-xs text-neutral-400 max-w-xs mx-auto">
                If an active account exists for <span className="text-[#d4a437] font-semibold">{email}</span>, security recovery instructions have been sent.
              </p>
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-white/[0.06] text-center">
            <Link
              to="/login"
              className="inline-flex items-center space-x-1.5 text-xs text-neutral-400 hover:text-neutral-200 font-medium transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Gateway Sign In</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
