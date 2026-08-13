import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setSubmitted(true);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-floating backdrop-blur-xl">
          {!submitted ? (
            <>
              <h2 className="text-xl font-bold text-white mb-2">Reset your password</h2>
              <p className="text-xs text-slate-400 mb-6">
                Enter your registered corporate email address and we will send instructions to reset your password.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label="Corporate Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@hotel-erp.com"
                  required
                  leftIcon={<Mail className="w-4 h-4" />}
                />
                <Button type="submit" variant="primary" size="lg" className="w-full" isLoading={isLoading}>
                  Send Recovery Link
                </Button>
              </form>
            </>
          ) : (
            <div className="text-center py-4 space-y-3">
              <div className="w-12 h-12 bg-brand-500/10 text-brand-400 rounded-2xl flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Reset link sent!</h3>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                If an account exists for <span className="text-slate-200 font-semibold">{email}</span>, you will receive password reset instructions shortly.
              </p>
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-slate-800 text-center">
            <Link
              to="/login"
              className="inline-flex items-center space-x-1.5 text-xs text-slate-400 hover:text-slate-200 font-medium transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Sign In</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
