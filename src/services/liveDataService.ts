/**
 * liveDataService.ts
 * Provides useLiveUserStats and useLivePlatformStats hooks for HomePage.
 *
 * Strategy:
 *  - Reads real user data from LocalAuth context (trips, rating, balance).
 *  - Falls back to wallet API when a live session is available.
 *  - Platform stats are NOT simulated. Until a real server-side aggregate
 *    exists, useLivePlatformStats returns null and callers must hide the
 *    widget rather than show invented numbers.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocalAuth } from '../contexts/LocalAuth';
import { useAuth } from '../contexts/AuthContext';
import { walletApi } from './walletApi';
import { getConnectedStats } from './journeyLogistics';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LiveUserStats {
  totalTrips: number;
  totalSaved: number; // in JOD
  /** 0 means "no ratings yet" - never a default score. */
  rating: number;
  pkgsDelivered: number;
  walletBalance: number; // in JOD
}

export interface LivePlatformStats {
  activeDrivers: number;
  avgWaitMinutes: number;
  passengersMatchedToday: number;
}

// ── useLiveUserStats ──────────────────────────────────────────────────────────

/**
 * Returns per-user stats that power the HomeScreen stat cards.
 * Tries the wallet API first; falls back to LocalAuth data.
 */
export function useLiveUserStats(): { stats: LiveUserStats | null; loading: boolean } {
  const { user: localUser } = useLocalAuth();
  const { user: authUser } = useAuth();
  const [stats, setStats] = useState<LiveUserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchingRef = useRef(false);

  const authUserId = authUser?.id;
  const localTrips = localUser?.trips;
  const localRating = localUser?.rating;
  const localBalance = localUser?.balance;

  const load = useCallback(async () => {
    if (fetchingRef.current) {return;}
    fetchingRef.current = true;
    setLoading(true);
    // NOTE: fetchingRef is reset inside the function body (not before the timer
    // fires) so rapid re-renders that cancel and reschedule the effect cannot
    // leave fetchingRef stuck at true while load is not running.

    const connectedStats = getConnectedStats();
    // Only report what is actually known. No estimated savings and no default
    // rating: unknown values are 0.
    const baseStats: LiveUserStats = {
      totalTrips: localTrips ?? connectedStats.ridesPosted,
      totalSaved: 0,
      rating: localRating ?? 0,
      pkgsDelivered: connectedStats.packagesCreated,
      walletBalance: localBalance ?? 0,
    };

    if (authUserId) {
      try {
        const wallet = await walletApi.getWallet(authUserId);
        setStats({
          totalTrips: localTrips ?? connectedStats.ridesPosted,
          totalSaved: wallet.total_earned ?? baseStats.totalSaved,
          rating: localRating ?? 0,
          pkgsDelivered: connectedStats.packagesCreated,
          walletBalance: wallet.balance ?? baseStats.walletBalance,
        });
        setLoading(false);
        fetchingRef.current = false;
        return;
      } catch {
        // wallet API unavailable — fall through to baseline
      }
    }

    setStats(baseStats);
    setLoading(false);
    fetchingRef.current = false;
  }, [authUserId, localTrips, localRating, localBalance]);

  useEffect(() => {
    // Reset the guard when deps change so the next scheduled load is not
    // blocked by a stale true value from a previous render cycle.
    fetchingRef.current = false;
    const timer = setTimeout(() => void load(), 0);
    return () => {
      clearTimeout(timer);
      // Cancel any in-flight fetch when deps change so stale results are
      // never applied after a rapid auth state transition.
      fetchingRef.current = false;
    };
  }, [load]);

  return { stats, loading };
}

// ── useLivePlatformStats ──────────────────────────────────────────────────────

/**
 * Platform-wide stats for the "Live Platform" widget.
 *
 * Previously this fabricated active drivers, wait time and matches from
 * hardcoded peak/off-peak numbers plus random jitter. That is removed: it
 * returns null until a real aggregate endpoint backs it, and callers must hide
 * the widget when it is null.
 */
export function useLivePlatformStats(): LivePlatformStats | null {
  return null;
}
