"use client";

import { useState } from "react";
import { YellowService } from "@/services/yellow.service";
import { useYellow } from "@/hooks/useYellow";

interface DemoLogEntry {
  timestamp: string;
  level: 'info' | 'error' | 'success';
  message: string;
  data?: any;
}

export default function YellowDemo() {
  const { isAuthenticated, yellowClient } = useYellow();
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<DemoLogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleRunDemo = async () => {
    setLoading(true);
    setError(null);
    setLogs([]);

    try {
      const result = await YellowService.runDemo();
      
      if (result.success) {
        setLogs(result.logs);
      } else {
        setError(result.error || "Demo failed");
        setLogs(result.logs || []);
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setLogs([]);
    setError(null);
  };

  if (!isAuthenticated) {
    return (
      <div className="bg-white/5 border border-white/10 p-8">
        <div className="text-center space-y-4">
          <p className="text-sm text-white/60 font-mono">
            Connect your wallet to try the Yellow Network x402 demo
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-mono text-white/60 uppercase tracking-wider text-center mb-6">
        Live Demo - Pay-Per-Call API
      </h3>

      <div className="bg-white/5 border border-white/10 p-6 space-y-6">
        {/* Run Demo Button */}
        <button
          onClick={handleRunDemo}
          disabled={loading}
          className="w-full px-6 py-3 bg-[#FCD535] text-black font-bold text-sm uppercase tracking-wider hover:bg-[#FCD535]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
              <span>Running Demo...</span>
            </>
          ) : (
            <span>Run Full Demo (3 Payments)</span>
          )}
        </button>

        {/* Logs */}
        {logs.length > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-mono text-white/60 uppercase tracking-wider">
                Demo Logs
              </label>
              <button
                onClick={reset}
                className="text-xs font-mono text-white/60 hover:text-white transition-colors"
              >
                Clear
              </button>
            </div>
            <div className="bg-black border border-white/10 p-4 overflow-auto max-h-96 space-y-1">
              {logs.map((log, idx) => (
                <div key={idx} className="text-xs font-mono">
                  <span className="text-white/40">{new Date(log.timestamp).toLocaleTimeString()}</span>
                  {' '}
                  <span className={
                    log.level === 'success' ? 'text-green-400' :
                    log.level === 'error' ? 'text-red-400' :
                    'text-white/60'
                  }>
                    [{log.level.toUpperCase()}]
                  </span>
                  {' '}
                  <span className="text-white">{log.message}</span>
                  {log.data && (
                    <pre className="text-white/40 ml-4 mt-1">
                      {JSON.stringify(log.data, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 p-4">
            <p className="text-xs font-mono text-red-400">{error}</p>
          </div>
        )}

        {/* Info */}
        <div className="text-xs font-mono text-white/40 space-y-1">
          <p>💡 Demo executes 3 paid API calls with instant off-chain payments</p>
          <p>⚡ All payments settle in milliseconds with zero gas fees</p>
          {yellowClient && (
            <p>🔑 Your Yellow address: {yellowClient.address}</p>
          )}
        </div>
      </div>
    </div>
  );
}
