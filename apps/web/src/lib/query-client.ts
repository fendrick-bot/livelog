import { MutationCache, QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ApiError, errorMessage } from './api';

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: { silent?: boolean; success?: string };
  }
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
        return failureCount < 2;
      },
    },
  },
  mutationCache: new MutationCache({
    onError: (error, _vars, _ctx, mutation) => {
      // Validation errors are shown next to the fields instead.
      if (
        mutation.meta?.silent ||
        (error instanceof ApiError && error.code === 'VALIDATION_FAILED')
      )
        return;
      toast.error(errorMessage(error));
    },
    onSuccess: (_data, _vars, _ctx, mutation) => {
      if (mutation.meta?.success) toast.success(mutation.meta.success);
    },
  }),
});
