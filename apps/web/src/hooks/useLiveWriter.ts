import { diffText, type PresencePayload } from '@livelog/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getSocket } from '../lib/socket';

export type WriterStatus = 'idle' | 'connecting' | 'synced' | 'sending' | 'offline' | 'error';

const FLUSH_INTERVAL_MS = 60;

/**
 * Streams the writer's text to readers while a log is live.
 *
 * Keystrokes are batched every ~60ms into a single minimal TextOp and sent
 * with the version they were based on. If the server's version differs
 * (reconnect, restart, another tab), the writer sends a full snapshot
 * instead, so readers always converge on exactly what the writer sees.
 */
export function useLiveWriter(logId: string, active: boolean, initialText: string) {
  const [status, setStatus] = useState<WriterStatus>('idle');
  const [viewers, setViewers] = useState(0);
  const latest = useRef(initialText);
  const sent = useRef<string | null>(null);
  const version = useRef(0);
  const inflight = useRef<Promise<void> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(active);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  const flush = useCallback(async (): Promise<void> => {
    if (inflight.current) return inflight.current;
    if (!activeRef.current || sent.current === null) return;
    const target = latest.current;
    const op = diffText(sent.current, target);
    if (!op) return;

    const socket = getSocket();
    const run = (async () => {
      setStatus('sending');
      try {
        const result = await socket
          .timeout(5_000)
          .emitWithAck('live:op', { logId, baseVersion: version.current, op });
        if (result.ok) {
          sent.current = target;
          version.current = result.data.version;
        } else if (result.code === 'NOT_LIVE') {
          setStatus('error');
          return;
        } else {
          const replaced = await socket
            .timeout(5_000)
            .emitWithAck('live:replace', { logId, content: target });
          if (!replaced.ok) throw new Error(replaced.message);
          sent.current = target;
          version.current = replaced.data.version;
        }
        setStatus('synced');
      } catch {
        setStatus(socket.connected ? 'error' : 'offline');
      }
    })();

    inflight.current = run;
    await run;
    inflight.current = null;
    if (activeRef.current && socket.connected && latest.current !== sent.current) {
      timer.current = setTimeout(() => void flush(), FLUSH_INTERVAL_MS);
    }
  }, [logId]);

  useEffect(() => {
    if (!active) {
      sent.current = null;
      setStatus('idle');
      return;
    }
    const socket = getSocket();
    let disposed = false;

    const join = async () => {
      setStatus('connecting');
      try {
        const result = await socket.timeout(8_000).emitWithAck('log:join', logId);
        if (disposed) return;
        if (!result.ok || !result.data.snapshot) {
          setStatus('error');
          return;
        }
        setViewers(result.data.viewers);
        sent.current = result.data.snapshot.content;
        version.current = result.data.snapshot.version;
        setStatus('synced');
        // Anything typed while (re)connecting goes out now.
        if (latest.current !== sent.current) void flush();
      } catch {
        if (!disposed) setStatus('offline');
      }
    };

    const onConnect = () => {
      if (socket.recovered && sent.current !== null) {
        setStatus('synced');
        void flush();
      } else {
        void join();
      }
    };
    const onDisconnect = () => setStatus('offline');
    const onPresence = (payload: PresencePayload) => {
      if (payload.logId === logId) setViewers(payload.viewers);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('presence', onPresence);
    if (socket.connected) void join();
    else setStatus('offline');

    return () => {
      disposed = true;
      if (timer.current) clearTimeout(timer.current);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('presence', onPresence);
    };
  }, [active, logId, flush]);

  /** Record the latest text; it is sent on the next tick while live. */
  const push = useCallback(
    (text: string) => {
      latest.current = text;
      if (!activeRef.current || timer.current) return;
      timer.current = setTimeout(() => {
        timer.current = null;
        void flush();
      }, FLUSH_INTERVAL_MS);
    },
    [flush],
  );

  /** Waits until everything typed so far has reached the server (call before ending the stream). */
  const settle = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    for (let attempt = 0; attempt < 5; attempt++) {
      if (inflight.current) await inflight.current;
      if (sent.current === null || latest.current === sent.current) return;
      await flush();
    }
  }, [flush]);

  return { status, viewers, push, settle };
}
