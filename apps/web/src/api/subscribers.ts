import type { MessageDto } from '@livelog/shared';
import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useSubscribe() {
  return useMutation({
    mutationFn: (email: string) => api.post<MessageDto>('/subscribers', { email }),
  });
}

export function useConfirmSubscription() {
  return useMutation({
    mutationFn: (token: string) => api.post<MessageDto>('/subscribers/confirm', { token }),
    meta: { silent: true },
  });
}

export function useUnsubscribe() {
  return useMutation({
    mutationFn: (token: string) => api.post<MessageDto>('/subscribers/unsubscribe', { token }),
    meta: { silent: true },
  });
}
