// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';

import App from './App';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { WishlistProvider } from './context/WishlistContext';
import { ThemeProvider } from "./components/UI/ThemeProvider";
import './index.css';
import './i18n';
import { PricingModeProvider } from './context/PricingModeProvider';
// ✅ React Query
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
      staleTime: 60 * 1000, // 1 min
      gcTime: 5 * 60 * 1000,
    },
  },
});

const rootEl = document.getElementById('root') as HTMLElement;

createRoot(rootEl).render(
  <StrictMode>
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <CartProvider>
            <WishlistProvider>
              <ThemeProvider>
                <PricingModeProvider>
      <App />
    </PricingModeProvider>
              </ThemeProvider>
            </WishlistProvider>
          </CartProvider>
        </AuthProvider>
      </QueryClientProvider>
    </HelmetProvider>
  </StrictMode>
);
;
