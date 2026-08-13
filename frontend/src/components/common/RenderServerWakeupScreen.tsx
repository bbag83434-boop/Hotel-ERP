import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Sparkles, RefreshCw, WifiOff, AlertTriangle, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface RenderServerWakeupScreenProps {
  onServerReady?: () => void;
  minDisplayTimeMs?: number;
}

export const RenderServerWakeupScreen: React.FC<RenderServerWakeupScreenProps> = ({
  onServerReady,
  minDisplayTimeMs = 600
}) => {
  const [isServerUp, setIsServerUp] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [hasTimedOut, setHasTimedOut] = useState<boolean>(false);
  const [isExiting, setIsExiting] = useState<boolean>(false);

  const mountTimeRef = useRef<number>(Date.now());
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const isComponentMounted = useRef<boolean>(true);

  // Ping /api/health endpoint
  const checkHealth = useCallback(async (): Promise<boolean> => {
    try {
      setIsChecking(true);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      // Probe backend /api/health directly
      const res = await fetch('/api/health', {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      if (isComponentMounted.current) {
        setIsChecking(false);
      }
    }
  }, []);

  const handleServerAwake = useCallback(() => {
    setIsServerUp(true);
    const timeSpent = Date.now() - mountTimeRef.current;
    const remainingTime = Math.max(0, minDisplayTimeMs - timeSpent);

    setTimeout(() => {
      if (isComponentMounted.current) {
        setIsExiting(true);
        setTimeout(() => {
          if (isComponentMounted.current) {
            setIsDismissed(true);
            onServerReady?.();
          }
        }, 450);
      }
    }, remainingTime);
  }, [minDisplayTimeMs, onServerReady]);

  // Main polling loop
  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);

    const poll = async () => {
      const isUp = await checkHealth();
      if (isUp) {
        if (pollRef.current) clearInterval(pollRef.current);
        if (timerRef.current) clearInterval(timerRef.current);
        handleServerAwake();
      }
    };

    // Initial immediate probe
    poll();

    // Repeat probe every 2.5 seconds
    pollRef.current = setInterval(poll, 2500);
  }, [checkHealth, handleServerAwake]);

  // Timer counter & timeout detection
  useEffect(() => {
    isComponentMounted.current = true;
    startPolling();

    timerRef.current = setInterval(() => {
      setElapsedSeconds((prev) => {
        const next = prev + 1;
        if (next >= 45) {
          setHasTimedOut(true);
        }
        return next;
      });
    }, 1000);

    return () => {
      isComponentMounted.current = false;
      if (pollRef.current) clearInterval(pollRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startPolling]);

  const handleRetry = () => {
    setHasTimedOut(false);
    setElapsedSeconds(0);
    mountTimeRef.current = Date.now();
    startPolling();
  };

  const handleContinueOffline = () => {
    setIsExiting(true);
    setTimeout(() => {
      setIsDismissed(true);
      onServerReady?.();
    }, 300);
  };

  if (isDismissed) {
    return null;
  }

  // Dynamic Status Message based on server wake-up elapsed time
  let statusText = 'Connecting to server...';
  let detailHint = 'Checking secure connection to Hotel Management services.';

  if (isServerUp) {
    statusText = 'Server Connected! Welcome.';
    detailHint = 'Ready to launch Hotel Management System.';
  } else if (hasTimedOut) {
    statusText = 'Server connection is taking longer than expected.';
    detailHint = 'The Render free-tier cloud instance may still be spinning up. You can retry or continue in offline mode.';
  } else if (elapsedSeconds >= 15) {
    statusText = 'Waking up Hotel Management cloud instance...';
    detailHint = 'Render free-tier servers spin down when idle. Initializing database and services (takes 20–40s)...';
  } else if (elapsedSeconds >= 4) {
    statusText = 'Starting Hotel Management server...';
    detailHint = 'Waking up application instance. Please hold on a moment...';
  }

  return (
    <div
      id="render-wakeup-screen"
      className={`fixed inset-0 z-[99999] flex flex-col items-center justify-between bg-slate-950 text-slate-100 p-6 sm:p-10 select-none overflow-hidden transition-all duration-500 ${
        isExiting ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'
      }`}
      style={{
        paddingTop: 'max(1.5rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
        paddingLeft: 'max(1.5rem, env(safe-area-inset-left))',
        paddingRight: 'max(1.5rem, env(safe-area-inset-right))'
      }}
    >
      {/* Background Ambience / Subtle Grid */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-amber-500/10 blur-3xl animate-pulse" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-brand-500/5 blur-3xl" />
      </div>

      {/* Top Header / Developer Brand Stamp */}
      <header className="relative z-10 w-full flex items-center justify-between pt-2">
        <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-slate-900/80 border border-amber-500/30 shadow-lg shadow-amber-950/20 backdrop-blur-md">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-amber-300 font-mono">
            CHEF BISU
          </span>
        </div>
        <div className="flex items-center space-x-1.5 text-[11px] text-slate-400 bg-slate-900/50 px-3 py-1 rounded-full border border-slate-800 backdrop-blur-md">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-mono">Render Cloud PWA</span>
        </div>
      </header>

      {/* Central Brand Core & Loading Visual */}
      <main className="relative z-10 flex flex-col items-center justify-center max-w-md w-full text-center my-auto space-y-6">
        {/* Luxury Hospitality Emblem with Ring Animation */}
        <div className="relative flex items-center justify-center">
          {/* Pulsing Outer Aura */}
          <div
            className={`absolute w-32 h-32 rounded-3xl transition-all duration-700 ${
              isServerUp
                ? 'bg-emerald-500/20 shadow-2xl shadow-emerald-500/30 scale-105'
                : 'bg-gradient-to-tr from-amber-500/20 via-brand-500/20 to-indigo-500/20 animate-pulse'
            }`}
          />

          {/* Rotating Spinner Ring (Active when loading) */}
          {!isServerUp && !hasTimedOut && (
            <div className="absolute w-28 h-28 rounded-3xl border-2 border-transparent border-t-amber-400 border-r-brand-400 animate-spin" />
          )}

          {/* Central Logo Box */}
          <div className="relative w-24 h-24 rounded-2xl bg-gradient-to-b from-slate-800 to-slate-900 border border-amber-500/40 flex flex-col items-center justify-center shadow-2xl shadow-black/80">
            {isServerUp ? (
              <CheckCircle2 className="w-12 h-12 text-emerald-400 animate-bounce" />
            ) : hasTimedOut ? (
              <AlertTriangle className="w-11 h-11 text-amber-400 animate-pulse" />
            ) : (
              <div className="flex flex-col items-center">
                {/* Hospitality Crest / Monogram */}
                <div className="text-3xl font-extrabold tracking-tighter bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 bg-clip-text text-transparent font-serif">
                  HM
                </div>
                <span className="text-[9px] font-bold uppercase tracking-widest text-amber-300/80 -mt-1 font-mono">
                  ERP
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Brand Typography Hierarchy */}
        <div className="space-y-1.5">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-400 font-mono">
            CHEF BISU
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Hotel Management
          </h1>
          <p className="text-xs sm:text-sm font-medium text-slate-300 tracking-wide">
            Hospitality Management System
          </p>
        </div>

        {/* Status Indicator & Description */}
        <div className="w-full bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 sm:p-5 backdrop-blur-xl shadow-xl space-y-3">
          <div className="flex items-center justify-center space-x-2">
            {!isServerUp && !hasTimedOut && (
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            )}
            {isServerUp && <div className="w-2 h-2 rounded-full bg-emerald-400" />}
            {hasTimedOut && <div className="w-2 h-2 rounded-full bg-rose-400" />}

            <span
              className={`text-xs sm:text-sm font-bold tracking-tight ${
                isServerUp
                  ? 'text-emerald-400'
                  : hasTimedOut
                  ? 'text-rose-400'
                  : 'text-slate-200'
              }`}
            >
              {statusText}
            </span>
          </div>

          <p className="text-[11px] sm:text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
            {detailHint}
          </p>

          {/* Live Progress Bar Indicator */}
          {!isServerUp && !hasTimedOut && (
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden relative mt-2">
              <div
                className="h-full bg-gradient-to-r from-amber-500 via-brand-500 to-indigo-500 rounded-full transition-all duration-1000 ease-out"
                style={{
                  width: `${Math.min(95, Math.max(10, elapsedSeconds * 2.8))}%`
                }}
              />
            </div>
          )}

          {/* Timeout Actions / Fallback Controls */}
          {hasTimedOut && (
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={handleRetry}
                className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-900/30 flex items-center justify-center space-x-2 transition-transform active:scale-95 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
                <span>Retry Connection</span>
              </button>
              <button
                type="button"
                onClick={handleContinueOffline}
                className="w-full sm:w-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 flex items-center justify-center space-x-2 transition-transform active:scale-95 cursor-pointer"
              >
                <WifiOff className="w-3.5 h-3.5 text-slate-400" />
                <span>Continue Offline</span>
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Footer / Hospitality Cloud Status */}
      <footer className="relative z-10 w-full flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 pt-3 border-t border-slate-900 gap-1">
        <span className="font-mono">Chef Bisu • Hotel Management • India Edition</span>
        <span className="font-mono text-slate-400">
          {elapsedSeconds > 0 && !isServerUp ? `Elapsed: ${elapsedSeconds}s` : 'Status: Ready'}
        </span>
      </footer>
    </div>
  );
};
