import type { LiveStatusDto } from '@livelog/shared';
import { useEffect } from 'react';
import { useLiveStatusQuery } from '../api/logs';
import { queryClient } from '../lib/query-client';
import { qk } from '../lib/query-keys';
import { getSocket } from '../lib/socket';

let serverOffsetMs = 0;
/** Milliseconds to add to Date.now() to get the server's clock (keeps countdowns honest). */
export const serverOffset = () => serverOffsetMs;

function remember(status: LiveStatusDto) {
  serverOffsetMs = new Date(status.serverTime).getTime() - Date.now();
}

/** Live status (who's live, what's next) kept fresh by socket pushes instead of polling. */
export function useLiveStatus() {
  const query = useLiveStatusQuery();

  useEffect(() => {
    if (query.data) remember(query.data);
  }, [query.data]);

  useEffect(() => {
    const socket = getSocket();
    const onStatus = (status: LiveStatusDto) => {
      remember(status);
      queryClient.setQueryData(qk.liveStatus, status);
    };
    const onConnect = () => {
      if (!socket.recovered) void queryClient.invalidateQueries({ queryKey: qk.liveStatus });
    };
    socket.on('live:status', onStatus);
    socket.on('connect', onConnect);
    return () => {
      socket.off('live:status', onStatus);
      socket.off('connect', onConnect);
    };
  }, []);

  return query;
}
