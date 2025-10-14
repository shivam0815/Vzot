import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';

type SEOProps = {
  title?: string;
  description?: string;
  image?: string;
  canonicalPath?: string; // e.g. /products/123
  noindex?: boolean;
  jsonLd?: object | object[];
};

const SITE_NAME = 'Nakoda Mobile';
const SITE_URL = 'https://nakodamobile.com'; // <-- change to your domain
const DEFAULT_IMAGE = `${SITE_URL}/og-default.png`; // put a fallback in /public

export default function SEO({
  title,
  description = 'Shop premium tech accessories at great prices.',
  image,
  canonicalPath,
  noindex,
  jsonLd,
}: SEOProps) {
  const { pathname } = useLocation();
  const fullUrl = SITE_URL + (canonicalPath || pathname);
  const pageTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME;
  const ogImage = image || DEFAULT_IMAGE;

  return (
    <Helmet>
      {/* Basic */}
      <title>{pageTitle}</title>
      {description && <meta name="description" content={description} />}
      <link rel="canonical" href={fullUrl} />
      {noindex && <meta name="robots" content="noindex,nofollow" />}

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
      {jsonLd && (
        <script type="application/ld+json">
          {Array.isArray(jsonLd) ? JSON.stringify(jsonLd) : JSON.stringify(jsonLd)}
        </script>
      )}
    </Helmet>
  );
}
