import type { Product } from '../types';

export type PricingMode = 'retail' | 'wholesale';

export function getUnitPrice(p: Product, mode: PricingMode) {
  if (mode === 'wholesale' && p.wholesaleEnabled && p.wholesalePrice != null) return p.wholesalePrice!;
  return p.price;
}

export function getMinQty(p: Product, mode: PricingMode) {
  if (mode === 'wholesale' && p.wholesaleEnabled && p.wholesaleMinQty != null) return p.wholesaleMinQty!;
  return 1;
}
