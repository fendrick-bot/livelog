import { QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'motion/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import { Toaster } from 'sonner';
import { bootstrapAuth } from './lib/auth';
import { queryClient } from './lib/query-client';
import { router } from './router';
import './styles/index.css';

void bootstrapAuth();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user">
        <RouterProvider router={router} />
        <Toaster
          position="bottom-center"
          toastOptions={{
            className:
              '!font-serif !text-[1rem] !rounded-[4px] !border-[#dcc79c] !bg-[#f6eedb] !text-[#2b2118] !shadow-[0_18px_40px_-18px_rgba(20,10,4,0.8)]',
          }}
        />
      </MotionConfig>
    </QueryClientProvider>
  </StrictMode>,
);
