// src/components/Layout/SEO.tsx
import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';

type SEOProps = {
  title?: string;
  description?: string;
  image?: string;
  canonicalPath?: string;          // e.g. "/products?page=2"
  robots?: string;                 // e.g. "index,follow" | "noindex,follow"
  noindex?: boolean;               // backward compat; sets robots if robots not provided
  prevHref?: string | null;        // absolute URL or null
  nextHref?: string | null;        // absolute URL or null
  jsonLd?: object | object[];      // Product, ItemList, BreadcrumbList, etc.
};

const SITE_NAME = 'Nakoda Mobile';
const SITE_URL = 'https://nakodamobile.com';
const DEFAULT_IMAGE = `${SITE_URL}/og-default.png`;

export default function SEO({
  title,
  description = 'Shop premium tech accessories at great prices.',
  image,
  canonicalPath,
  robots,
  noindex,
  prevHref,
  nextHref,
  jsonLd,
}: SEOProps) {
  const { pathname } = useLocation();
  const fullUrl = SITE_URL + (canonicalPath || pathname);
  const pageTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME;
  const ogImage = image || DEFAULT_IMAGE;

  // resolve robots precedence
  const robotsContent =
    robots ??
    (noindex ? 'noindex,nofollow' : undefined);

  // normalize JSON-LD to array
  const jsonBlocks = Array.isArray(jsonLd) ? jsonLd : jsonLd ? [jsonLd] : [];

  return (
    <Helmet>
      {/* Basic */}
      <title>{pageTitle}</title>
      {description && <meta name="description" content={description} />}
      <link rel="canonical" href={fullUrl} />
      {robotsContent && <meta name="robots" content={robotsContent} />}

      {/* Pagination hints */}
      {prevHref ? <link rel="prev" href={prevHref} /> : null}
      {nextHref ? <link rel="next" href={nextHref} /> : null}

      {/* Open Graph */}
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={pageTitle} />
      {description && <meta property="og:description" content={description} />}
      <meta property="og:url" content={fullUrl} />
      {ogImage && <meta property="og:image" content={ogImage} />}

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={pageTitle} />
      {description && <meta name="twitter:description" content={description} />}
      {ogImage && <meta name="twitter:image" content={ogImage} />}

      {/* JSON-LD */}
      {jsonBlocks.map((block, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(block)}
        </script>
      ))}
    </Helmet>
  );
}
