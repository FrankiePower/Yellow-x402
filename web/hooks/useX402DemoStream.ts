/**
 * useX402DemoStream.ts - React hook for SSE streaming demo
 */

import { useState, useCallback } from 'react';

export interface DemoLogEntry {
  timestamp: string;
  level: 'info' | 'success' | 'error';
  message: string;
  data?: any;
}

export function useX402DemoStream(serviceUrl: string) {
  const [logs, setLogs] = useState<DemoLogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runDemo = useCallback(() => {
    setLogs([]);
    setError(null);
    setIsRunning(true);

    const eventSource = new EventSource(`${serviceUrl}/run-demo-stream`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'log') {
        setLogs((prev) => [...prev, data.log]);
      } else if (data.type === 'complete') {
        setIsRunning(false);
        eventSource.close();
      } else if (data.type === 'error') {
        setError(data.error);
        setIsRunning(false);
        eventSource.close();
      }
    };

    eventSource.onerror = () => {
      setError('Connection to server lost');
      setIsRunning(false);
      eventSource.close();
    };

    return () => {
      eventSource.close();
      setIsRunning(false);
    };
  }, [serviceUrl]);

  const reset = useCallback(() => {
    setLogs([]);
    setError(null);
  }, []);

  return { logs, isRunning, error, runDemo, reset };
}
