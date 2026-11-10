import { useCallback, useEffect, useRef, useState } from 'react';
import { requestEdgeJson } from '../../services/backendWorkflow';
import type { MobilitySystemSnapshot } from './model';
import { subscribeToMobilityCorridorChanges } from './mobilityRealtime';
import { mobilityOSRuntime } from './runtime';

const MOBILITY_OS_BASE = '/mobility-os';

async function fetchMobilityServerSnapshot(): Promise<MobilitySystemSnapshot> {
  return requestEdgeJson<MobilitySystemSnapshot>({
    path: `${MOBILITY_OS_BASE}/snapshot`,
    operation: 'Load Mobility OS snapshot',
    authMode: 'required',
  });
}

export function useMobilityOSServerState() {
  const [snapshot, setSnapshot] = useState<MobilitySystemSnapshot>(() =>
    mobilityOSRuntime.getSnapshot(),
  );
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<'server' | 'fallback'>('fallback');
  const activeRef = useRef(true);

  const loadSnapshot = useCallback(async () => {
    try {
      const next = await fetchMobilityServerSnapshot();

      if (!activeRef.current) {return;}
      setSnapshot(next);
      setSource('server');
    } catch {
      if (!activeRef.current) {return;}
      setSnapshot(mobilityOSRuntime.getSnapshot());
      setSource('fallback');
    } finally {
      if (activeRef.current) {setLoading(false);}
    }
  }, []);

  useEffect(() => {
    activeRef.current = true;
    const timer = setTimeout(() => void loadSnapshot(), 0);

    const unsubscribe = subscribeToMobilityCorridorChanges(() => {
      if (!activeRef.current) {return;}
      void loadSnapshot();
    });
    const unsubscribeFallback = mobilityOSRuntime.subscribe(() => {
      if (!activeRef.current) {return;}
      setSnapshot(mobilityOSRuntime.getSnapshot());
    });

    return () => {
      activeRef.current = false;
      clearTimeout(timer);
      unsubscribe();
      unsubscribeFallback();
    };
  }, [loadSnapshot]);

  return {
    snapshot,
    loading,
    source,
  };
}
