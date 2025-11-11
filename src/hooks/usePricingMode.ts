import { useEffect, useState } from 'react';

export type PricingMode = 'retail' | 'wholesale';

export function usePricingMode() {
  const [mode, setMode] = useState<PricingMode>(
    (localStorage.getItem('pricingMode') as PricingMode) || 'retail'
  );

  useEffect(() => {
    const onMode = (e: any) => setMode(e?.detail === 'wholesale' ? 'wholesale' : 'retail');
    window.addEventListener('pricing:mode', onMode as any);
    return () => window.removeEventListener('pricing:mode', onMode as any);
  }, []);

  const toggle = () => {
    const next: PricingMode = mode === 'retail' ? 'wholesale' : 'retail';
    localStorage.setItem('pricingMode', next);
    window.dispatchEvent(new CustomEvent('pricing:mode', { detail: next }));
    setMode(next);
  };

  return { mode, toggle, setMode };
}
