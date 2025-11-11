import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

type Mode = 'retail' | 'wholesale';
type Ctx = { mode: Mode; setMode: (m: Mode) => void; toggle: () => void; };
const PricingModeCtx = createContext<Ctx | null>(null);

export const PricingModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<Mode>(() => (localStorage.getItem('pricing-mode') as Mode) || 'retail');
  useEffect(() => { localStorage.setItem('pricing-mode', mode); }, [mode]);
  const value = useMemo(() => ({ mode, setMode, toggle: () => setMode(mode === 'retail' ? 'wholesale' : 'retail') }), [mode]);
  return <PricingModeCtx.Provider value={value}>{children}</PricingModeCtx.Provider>;
};

export const usePricingMode = () => {
  const ctx = useContext(PricingModeCtx);
  if (!ctx) throw new Error('usePricingMode must be used within PricingModeProvider');
  return ctx;
};
