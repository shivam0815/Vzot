// src/pages/Categories.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, createSearchParams } from 'react-router-dom';
import CategoriesCinematic, { CategoryItem } from '../components/Layout/CategoriesCinematic';
import CategoriesCarousel from '../components/Layout/CategoriesCarousel';
import { productService } from '../services/productService';
import type { Product } from '../types';
import { motion } from 'framer-motion';
import SEO from '../components/Layout/SEO';

const PALETTE = [
  'from-blue-600 to-purple-600',
  'from-indigo-600 to-sky-600',
  'from-emerald-600 to-teal-600',
  'from-fuchsia-600 to-pink-600',
  'from-cyan-600 to-sky-600',
  'from-amber-600 to-orange-600',
];

function slugify(input: string) {
  return (input || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}
const pickAccent = (i: number) => PALETTE[i % PALETTE.length];

function buildCategoryItems(categoryNames: string[], products: Product[]): CategoryItem[] {
  const names = categoryNames?.length
    ? categoryNames
    : Array.from(new Set((products || []).map((p) => p.category).filter(Boolean)));

  return names.map((name, idx) => {
    const inCat = (products || []).filter((p) => p.category === name);

    const counts = new Map<string, number>();
    inCat.forEach((p) => {
      const key = (p as any).brand || 'Others';
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    const sub = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([brand, count]) => ({
        id: `${slugify(name)}-${slugify(brand)}`,
        name: brand,
        productCount: count,
        slug: slugify(brand),
      }));

    const previewImage = (inCat.find((p) => Array.isArray((p as any).images) && (p as any).images[0]) as any)?.images?.[0];

    return {
      id: slugify(name),
      name,
      description: `${inCat.length} product${inCat.length === 1 ? '' : 's'}`,
      accent: pickAccent(idx),
      image: previewImage,
      subcategories: sub,
    };
  });
}

const CategoriesPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>('');
  const [items, setItems] = useState<CategoryItem[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr('');
        const prodsResp = await productService.getProducts({ limit: 1000 });
        if (!alive) return;
        const built = buildCategoryItems([], (prodsResp as any).products || (prodsResp as any).data || []);
        setItems(built);
      } catch (e: any) {
        if (!alive) return;
        console.error(e);
        setErr(e?.message || 'Failed to load categories');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const onSelectCategory = (cat: CategoryItem) => {
    navigate({
      pathname: '/products',
      search: `?${createSearchParams({ category: slugify(cat.name) })}`,
    });
  };

  const onSelectSubcategory = (cat: CategoryItem, sub: { name: string }) => {
    navigate({
      pathname: '/products',
      search: `?${createSearchParams({ category: slugify(cat.name), brand: slugify(sub.name) })}`,
    });
  };

  const countAll = useMemo(
    () =>
      items.reduce(
        (acc, c) => acc + (c.subcategories?.reduce((s, sc) => s + (sc.productCount || 0), 0) || 0),
        0
      ),
    [items]
  );

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen bg-white text-gray-800 flex items-center justify-center">
        <SEO
          title="Browse Categories"
          description="Explore categories like TWS, neckbands, chargers, cables, ICs, and more."
          canonicalPath="/categories"
          robots="index,follow"
          jsonLd={{
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: 'Categories',
            url: 'https://nakodamobile.com/categories',
          }}
        />
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
          <div className="animate-spin h-12 w-12 border-2 border-blue-200 border-t-blue-600 rounded-full mx-auto mb-4" />
          <div className="text-gray-700">Loading categories…</div>
        </motion.div>
      </div>
    );
  }

  // Error
  if (err) {
    return (
      <div className="min-h-screen bg-white text-gray-800 flex items-center justify-center">
        <SEO title="Browse Categories" description="Explore categories" canonicalPath="/categories" robots="noindex,follow" />
        <div className="text-center">
          <div className="text-red-600 font-medium mb-3">⚠️ {err}</div>
          <button
            onClick={() => location.reload()}
            className="px-5 py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // SEO blocks for normal view
  const canonicalPath = '/categories';
  const robots = 'index,follow';

  const categoryListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListOrder: 'http://schema.org/ItemListOrderAscending',
    numberOfItems: items.length,
    url: `https://nakodamobile.com${canonicalPath}`,
    itemListElement: items.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `https://nakodamobile.com/products?category=${encodeURIComponent(slugify(c.name))}`,
      name: c.name,
      image: c.image || undefined,
    })),
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://nakodamobile.com/' },
      { '@type': 'ListItem', position: 2, name: 'Categories', item: `https://nakodamobile.com${canonicalPath}` },
    ],
  };

  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Categories',
    url: `https://nakodamobile.com${canonicalPath}`,
  };

  // View
  return (
    <div className="min-h-screen bg-white">
      <SEO
        title="Browse Categories"
        description="Explore categories like TWS, neckbands, chargers, cables, ICs, and more."
        canonicalPath={canonicalPath}
        robots={robots}
        jsonLd={[breadcrumbJsonLd, collectionJsonLd, categoryListJsonLd]}
      />

      <CategoriesCarousel
        items={items}
        onSelectCategory={onSelectCategory}
        onSelectSubcategory={onSelectSubcategory}
        title="Browse by Category"
        subtitle="Swipe to explore. Tap a chip for popular brands."
      />

      <CategoriesCinematic
        categories={items}
        heroGradient="from-blue-600 via-indigo-600 to-purple-600"
        overlayTint="bg-white/10"
        heroImages={items.map((i) => i.image!).filter(Boolean).slice(0, 6)}
        onSelectCategory={onSelectCategory}
        onSelectSubcategory={onSelectSubcategory}
        searchValue={search}
        onSearchChange={setSearch}
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-10 text-gray-600 text-sm">
        Total mapped product entries: <span className="text-gray-900 font-medium">{countAll}</span>
      </div>
    </div>
  );
};

export default CategoriesPage;
       