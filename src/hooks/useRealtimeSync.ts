import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

type TableName = 'rooms' | 'bookings' | 'reservations' | 'payments' | 'folio_charges' | 'guests';

interface UseRealtimeOptions {
  tables: TableName[];
  onUpdate: () => void;
  enabled?: boolean;
}

/**
 * Custom hook for real-time database subscriptions
 * Automatically refreshes data when changes occur on specified tables
 * 
 * Usage:
 * useRealtimeSync({
 *   tables: ['rooms', 'bookings'],
 *   onUpdate: loadData,
 *   enabled: true
 * });
 */
export function useRealtimeSync({ tables, onUpdate, enabled = true }: UseRealtimeOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const onUpdateRef = useRef(onUpdate);

  // Keep the callback ref updated
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  const setupSubscription = useCallback(() => {
    if (!enabled || tables.length === 0) return;

    // Create a unique channel name
    const channelName = `realtime-sync-${tables.join('-')}-${Date.now()}`;
    
    // Create the channel
    const channel = supabase.channel(channelName);

    // Subscribe to each table
    tables.forEach(table => {
      channel.on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: table
        },
        (payload) => {
          console.log(`[Realtime] ${table} changed:`, payload.eventType);
          // Debounce rapid updates
          onUpdateRef.current();
        }
      );
    });

    // Subscribe to the channel
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`[Realtime] Subscribed to: ${tables.join(', ')}`);
      }
    });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled, tables]);

  useEffect(() => {
    const cleanup = setupSubscription();
    return cleanup;
  }, [setupSubscription]);
}

/**
 * Simple hook to subscribe to a single table
 */
export function useTableSync(table: TableName, onUpdate: () => void, enabled = true) {
  useRealtimeSync({
    tables: [table],
    onUpdate,
    enabled
  });
}

/**
 * Hook specifically for front desk operations
 * Subscribes to rooms, bookings, and reservations
 */
export function useFrontDeskSync(onUpdate: () => void, enabled = true) {
  useRealtimeSync({
    tables: ['rooms', 'bookings', 'reservations'],
    onUpdate,
    enabled
  });
}

/**
 * Hook for folio/billing operations
 * Subscribes to payments and charges
 */
export function useFolioSync(onUpdate: () => void, enabled = true) {
  useRealtimeSync({
    tables: ['payments', 'folio_charges'],
    onUpdate,
    enabled
  });
}

export default useRealtimeSync;
