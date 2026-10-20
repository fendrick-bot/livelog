import type { AuthSessionDto, DeviceSessionDto, LoginInput, SignupInput } from '@livelog/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { applySession, logout } from '../lib/auth';
import { qk } from '../lib/query-keys';

export function useLogin() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) => api.post<AuthSessionDto>('/auth/login', input),
    onSuccess: (session) => {
      applySession(session);
      void client.invalidateQueries();
    },
    meta: { silent: true },
  });
}

export function useSignup() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: SignupInput) => api.post<AuthSessionDto>('/auth/signup', input),
    onSuccess: (session) => {
      applySession(session);
      void client.invalidateQueries();
    },
    meta: { silent: true },
  });
}

export function useLogout() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      client.removeQueries({ queryKey: qk.admin.all });
      void client.invalidateQueries();
    },
  });
}

export function useSessions() {
  return useQuery({
    queryKey: qk.sessions,
    queryFn: ({ signal }) => api.get<DeviceSessionDto[]>('/auth/sessions', undefined, signal),
  });
}

export function useRevokeSession() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/auth/sessions/${id}`),
    onSuccess: () => client.invalidateQueries({ queryKey: qk.sessions }),
    meta: { success: 'That device has been signed out.' },
  });
}
