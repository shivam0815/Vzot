// src/constants/categories.ts
export const CATEGORY_NAMES = [
  'TWS',
  'Bluetooth Neckbands',
  'Data Cables',
  'Mobile Chargers',
  'Integrated Circuits & Chips',
  'Mobile Repairing Tools',
  'Electronics',
  'Mobile Accessories',
  'Car Chargers',
  'Bluetooth Speakers',
  'Power Banks',
  'Others',
] as const;

export type CategoryName = (typeof CATEGORY_NAMES)[number];

export const slugify = (s: string) =>
  (s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

export const CATEGORY_MAP: Record<string, CategoryName> = Object.fromEntries(
  CATEGORY_NAMES.map((name) => [slugify(name), name])
);
