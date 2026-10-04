import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/useAuthStore';
import { SSEEventData } from '@omnidrive/shared';

export function useSSE() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  useEffect(() => {
    if (!user) return;

    const eventSource = new EventSource('/api/events', { withCredentials: true });

    eventSource.onmessage = (event) => {
      try {
        const data: SSEEventData = JSON.parse(event.data);
        if (data.type === 'transfer_progress' || data.type === 'transfer_completed' || data.type === 'transfer_failed') {
          queryClient.invalidateQueries({ queryKey: ['transfers'] });
          queryClient.invalidateQueries({ queryKey: ['nodes'] });
          queryClient.invalidateQueries({ queryKey: ['storage'] });
        } else if (data.type === 'sync_completed' || data.type === 'account_updated') {
          queryClient.invalidateQueries({ queryKey: ['nodes'] });
          queryClient.invalidateQueries({ queryKey: ['accounts'] });
          queryClient.invalidateQueries({ queryKey: ['storage'] });
        }
      } catch {
        // Ping or malformed payload
      }
    };

    return () => {
      eventSource.close();
    };
  }, [user, queryClient]);
}
