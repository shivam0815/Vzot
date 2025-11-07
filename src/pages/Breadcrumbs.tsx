import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, ChevronRight } from "lucide-react";

type Crumb = {
  label: string;
  to?: string | { pathname: string; search?: string };
  state?: any;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
};

type Props = {
  items: Crumb[];
  className?: string;
  enableSmartBack?: boolean;
};

const CrumbSeparator = () => (
  <ChevronRight className="mx-1 h-4 w-4 text-white/40" aria-hidden="true" />
);

function isProductsPath(to?: Crumb["to"]) {
  if (!to) return false;
  if (typeof to === "string") return to === "/products";
  return to.pathname === "/products";
}

export default function Breadcrumbs({
  items,
  className = "",
  enableSmartBack = false,
}: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  if (!items?.length) return null;

  const fromPath =
    (location.state as any)?.fromPath ||
    sessionStorage.getItem("last-products-url") ||
    "/products";

  const cameFromProducts = (() => {
    try {
      if (!document.referrer) return false;
      const u = new URL(document.referrer);
      return (
        u.origin === window.location.origin &&
        u.pathname.startsWith("/products")
      );
    } catch {
      return false;
    }
  })();

  const smartBack: React.MouseEventHandler<HTMLAnchorElement> = (e) => {
    e.preventDefault();
    if (cameFromProducts && window.history.length > 1) navigate(-1);
    else navigate(fromPath, { replace: true });
  };

  const renderNode = (item: Crumb, isLast: boolean, index: number) => {
    const content = (
      <span
        className={`inline-flex items-center gap-1 rounded-md px-2 py-1 transition-colors ${
          isLast
            ? "bg-black/85 text-white font-medium"
            : "text-white/80 hover:text-white hover:bg-white/10"
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

    if (!item.to || isLast) {
      return <span itemProp="item">{content}</span>;
    }

    if (item.onClick) {
      const href = typeof item.to === "string" ? item.to : item.to.pathname || "/";
      return (
        <a href={href} onClick={item.onClick} itemProp="item">
          {content}
        </a>
      );
    }

    if (enableSmartBack && isProductsPath(item.to)) {
      const href =
        typeof item.to === "string" ? item.to : item.to.pathname || "/products";
      return (
        <a href={href} onClick={smartBack} itemProp="item">
          {content}
        </a>
      );
    }

    return (
      <Link to={item.to as any} state={item.state} itemProp="item">
        {content}
      </Link>
    );
  };

  return (
    <nav aria-label="Breadcrumb" className={`mb-6 ${className}`}>
      <ol
        className="flex items-center flex-wrap gap-1 text-sm text-white"
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
