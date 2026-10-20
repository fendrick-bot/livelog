import {
  applyOp,
  type CommentDto,
  type LiveEndedPayload,
  type LiveOpBroadcast,
  type LiveSnapshot,
  type LogDetailDto,
  type LogSummaryDto,
  type PresencePayload,
  type ReactionType,
  type ReactionUpdatePayload,
  type TextOp,
} from '@livelog/shared';
import { useEffect, useRef, useState } from 'react';
import { addCommentToCache, removeCommentFromCache } from '../api/comments';
import { queryClient } from '../lib/query-client';
import { qk } from '../lib/query-keys';
import { getSocket } from '../lib/socket';

interface LiveText {
  content: string;
  version: number;
}

export interface LogRoomHandlers {
  onOp?: (op: TextOp) => void;
  onReaction?: (type: ReactionType) => void;
  onEnded?: (payload: LiveEndedPayload) => void;
}

/**
 * Joins a log's realtime room for as long as the page is open.
 *
 * - While live, keeps `liveText` in sync by applying each op in order; any
 *   gap in versions (missed packet, reconnect) triggers a fresh snapshot.
 * - Pipes comments, reactions and status changes into the React Query cache
 *   so every component re-renders from one source of truth.
 */
export function useLogRoom(
  log: Pick<LogDetailDto, 'id' | 'slug' | 'status'> | undefined,
  handlers: LogRoomHandlers = {},
) {
  const logId = log?.id;
  const slug = log?.slug;
  const isLive = log?.status === 'live';

  const [liveText, setLiveText] = useState<LiveText | null>(null);
  const [viewers, setViewers] = useState(0);
  const [typingAt, setTypingAt] = useState(0);
  const textRef = useRef<LiveText | null>(null);
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    if (!logId || !slug) return;
    const socket = getSocket();
    let disposed = false;

    const setText = (next: LiveText | null) => {
      textRef.current = next;
      setLiveText(next);
    };

    const join = async () => {
      try {
        const result = await socket.timeout(8_000).emitWithAck('log:join', logId);
        if (disposed || !result.ok) return;
        setViewers(result.data.viewers);
        const snapshot = result.data.snapshot;
        setText(snapshot ? { content: snapshot.content, version: snapshot.version } : null);
      } catch {
        // Timed out: the reconnect handler will try again.
      }
    };

    const onConnect = () => {
      if (!socket.recovered) void join();
    };

    const onOp = (payload: LiveOpBroadcast) => {
      if (payload.logId !== logId) return;
      const current = textRef.current;
      if (!current || payload.version !== current.version + 1) {
        void join();
        return;
      }
      try {
        setText({ content: applyOp(current.content, payload.op), version: payload.version });
      } catch {
        void join();
        return;
      }
      setTypingAt(Date.now());
      handlersRef.current.onOp?.(payload.op);
    };

    const onSnapshot = (payload: LiveSnapshot) => {
      if (payload.logId === logId) setText({ content: payload.content, version: payload.version });
    };

    const onPresence = (payload: PresencePayload) => {
      if (payload.logId === logId) setViewers(payload.viewers);
    };

    const onUpdated = (summary: LogSummaryDto) => {
      if (summary.id !== logId) return;
      queryClient.setQueryData<LogDetailDto>(qk.log(slug), (current) => {
        if (!current) return current;
        const content =
          summary.status !== 'live' && textRef.current ? textRef.current.content : current.content;
        return { ...current, ...summary, content, viewerReactions: current.viewerReactions };
      });
      if (summary.status === 'live' && !textRef.current) void join();
    };

    const onEnded = (payload: LiveEndedPayload) => {
      if (payload.logId !== logId) return;
      handlersRef.current.onEnded?.(payload);
      void queryClient.invalidateQueries({ queryKey: qk.log(payload.slug) });
    };

    const onComment = (comment: CommentDto) => {
      if (comment.logId === logId) addCommentToCache(comment);
    };

    const onCommentRemoved = (payload: { logId: string; commentId: string }) => {
      if (payload.logId === logId) removeCommentFromCache(payload.logId, payload.commentId);
    };

    const onReaction = (payload: ReactionUpdatePayload) => {
      if (payload.logId !== logId) return;
      queryClient.setQueryData<LogDetailDto>(qk.log(slug), (current) =>
        current ? { ...current, reactionCounts: payload.counts } : current,
      );
      if (payload.delta > 0) handlersRef.current.onReaction?.(payload.type);
    };

    socket.on('connect', onConnect);
    socket.on('live:op', onOp);
    socket.on('live:snapshot', onSnapshot);
    socket.on('presence', onPresence);
    socket.on('log:updated', onUpdated);
    socket.on('live:ended', onEnded);
    socket.on('comment:new', onComment);
    socket.on('comment:removed', onCommentRemoved);
    socket.on('reaction:update', onReaction);
    if (socket.connected) void join();

    return () => {
      disposed = true;
      socket.off('connect', onConnect);
      socket.off('live:op', onOp);
      socket.off('live:snapshot', onSnapshot);
      socket.off('presence', onPresence);
      socket.off('log:updated', onUpdated);
      socket.off('live:ended', onEnded);
      socket.off('comment:new', onComment);
      socket.off('comment:removed', onCommentRemoved);
      socket.off('reaction:update', onReaction);
      socket.emit('log:leave', logId);
    };
  }, [logId, slug, isLive]);

  return { liveText: isLive ? liveText : null, viewers, typingAt };
}
