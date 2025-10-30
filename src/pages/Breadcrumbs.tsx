import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, ChevronRight } from "lucide-react";

type Crumb = {
  label: string;
  /** Path string or { pathname, search } object */
  to?: string | { pathname: string; search?: string };
  /** React Router location state (e.g., { fromPath }) */
  state?: any;
  /** Optional click handler for custom behavior */
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
};

type Props = {
  items: Crumb[];
  className?: string;
  /**
   * When true, clicks on a crumb whose `to` resolves to "/products"
   * will perform a smart back: go(-1) if user came from products,
   * else navigate to the last stored products URL from sessionStorage.
   */
  enableSmartBack?: boolean;
};

const CrumbSeparator = () => (
  <ChevronRight className="mx-1 h-4 w-4 text-gray-400" aria-hidden="true" />
);

function isProductsPath(to?: Crumb["to"]) {
  if (!to) return false;
  if (typeof to === "string") return to === "/products";
  return to.pathname === "/products";
}

export default function Breadcrumbs({ items, className = "", enableSmartBack = false }: Props) {
  const navigate = useNavigate();
  const location = useLocation();

  if (!items?.length) return null;

  // Compute smart back targets once
  const fromPath =
    (location.state as any)?.fromPath ||
    sessionStorage.getItem("last-products-url") ||
    "/products";

  const cameFromProducts = (() => {
    try {
      if (!document.referrer) return false;
      const u = new URL(document.referrer);
      return u.origin === window.location.origin && u.pathname.startsWith("/products");
    } catch {
      return false;
    }
  })();

  const smartBack: React.MouseEventHandler<HTMLAnchorElement> = (e) => {
    e.preventDefault();
    if (cameFromProducts && window.history.length > 1) {
      navigate(-1);
    } else {
      // If we have a concrete URL in sessionStorage, use that;
      // otherwise fall back to plain /products.
      navigate(fromPath, { replace: true });
    }
  };

  const renderNode = (item: Crumb, isLast: boolean, index: number) => {
    const content = (
      <span
        className={`inline-flex items-center gap-1 rounded-md px-2 py-1 transition-colors ${
          isLast
            ? "bg-gray-100 text-gray-900 font-medium"
            : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
        }`}
        itemProp="name"
        title={item.label}
      >
        {index === 0 && <Home className="h-4 w-4" aria-hidden="true" />}
        <span className={isLast ? "truncate max-w-[60vw] md:max-w-none" : ""}>
          {item.label}
        </span>
      </span>
    );

    // Current / active page: no link
    if (!item.to || isLast) {
      return (
        <span itemProp="item">
          {content}
        </span>
      );
    }

    // If caller provided a custom onClick, respect it
    if (item.onClick) {
      const href =
        typeof item.to === "string" ? item.to : (item.to.pathname || "/");
      return (
        <a href={href} onClick={item.onClick} itemProp="item">
          {content}
        </a>
      );
    }

    // Smart back for /products if enabled
    if (enableSmartBack && isProductsPath(item.to)) {
      const href =
        typeof item.to === "string" ? item.to : (item.to.pathname || "/products");
      return (
        <a href={href} onClick={smartBack} itemProp="item">
          {content}
        </a>
      );
    }

    // Default router link; pass through optional state
    return (
      <Link to={item.to as any} state={item.state} itemProp="item">
        {content}
      </Link>
    );
  };

  return (
    <nav aria-label="Breadcrumb" className={`mb-6 ${className}`}>
      <ol
        className="flex items-center flex-wrap gap-1 text-sm"
        itemScope
        itemType="https://schema.org/BreadcrumbList"
      >
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li
              key={`${item.label}-${i}`}
              className="flex items-center"
              itemProp="itemListElement"
              itemScope
              itemType="https://schema.org/ListItem"
            >
              {renderNode(item, isLast, i)}
              <meta itemProp="position" content={String(i + 1)} />
              {!isLast && <CrumbSeparator />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
