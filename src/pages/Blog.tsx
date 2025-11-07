// src/pages/Blog.tsx — dark aurora bg + glass cards
import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import SEO from '../components/Layout/SEO';
import { blogService } from '../services/blogService';

import VZOTBackground from '../components/Layout/VZOTBackground';

type PostCard = {
  title: string;
  slug: string;
  excerpt?: string;
  coverImage?: string;
  tags?: string[];
  author?: string;
  publishedAt?: string;
};

const Blog: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const [posts, setPosts] = useState<PostCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageInfo, setPageInfo] = useState({ page: 1, pages: 1, hasMore: false });

  const page = Number(params.get('page') || 1);
  const q = params.get('q') || '';
  const tag = params.get('tag') || '';

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const { posts, pagination } = await blogService.list({ page, q, tag });
        setPosts(posts);
        setPageInfo({
          page: pagination.page,
          pages: pagination.pages,
          hasMore: pagination.hasMore,
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [page, q, tag]);

  const go = (p: number) =>
    setParams({ ...(q && { q }), ...(tag && { tag }), page: String(p) });

  return (
    <div className="relative min-h-screen text-white">
      <VZOTBackground />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 -left-20 h-96 w-96 rounded-full blur-3xl opacity-40 bg-[radial-gradient(closest-side,var(--tw-gradient-from),transparent)] from-[#00d4ff]" />
        <div className="absolute top-1/3 -right-16 h-[28rem] w-[28rem] rounded-full blur-3xl opacity-30 bg-[radial-gradient(closest-side,var(--tw-gradient-from),transparent)] from-[#7c3aed]" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full blur-3xl opacity-25 bg-[radial-gradient(closest-side,var(--tw-gradient-from),transparent)] from-[#22c55e]" />
        {/* subtle vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_0%,rgba(255,255,255,0.06),rgba(0,0,0,0.6))]" />
      </div>

      <SEO
        title="Blog"
        description="Guides, tips and news from Nakoda Mobile: accessories, charging, audio, repair tools and more."
        canonicalPath="/blog"
      />

      {/* hero */}
      <section className="relative py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">Nakoda Blog</h1>
          <p className="mt-3 text-sm md:text-base text-gray-300">
            Insights on mobile accessories, charging tech, and repair.
          </p>
        </div>
      </section>

      {/* content */}
      <section className="relative pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* filters row (optional quick tag/search placeholders) */}
          {(q || tag) && (
            <div className="mb-6 text-xs text-gray-300">
              {q && <span className="mr-3">Query: “{q}”</span>}
              {tag && <span className="mr-3">Tag: #{tag}</span>}
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-64 rounded-2xl bg-white/5 backdrop-blur border border-white/10 animate-pulse"
                />
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="flex justify-center">
              <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur px-5 py-4 text-gray-200">
                No posts found.
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {posts.map((p) => (
                <article
                  key={p.slug}
                  className="group rounded-2xl overflow-hidden border border-white/10 bg-white/5 backdrop-blur transition-transform hover:-translate-y-1 hover:border-white/20"
                >
                  {p.coverImage && (
                    <Link to={`/blog/${p.slug}`} className="block">
                      <img
                        src={p.coverImage}
                        alt={p.title}
                        className="h-44 w-full object-cover"
                        loading="lazy"
                      />
                    </Link>
                  )}

                  <div className="p-5">
                    <Link
                      to={`/blog/${p.slug}`}
                      className="text-lg font-semibold text-white hover:text-cyan-300"
                    >
                      {p.title}
                    </Link>

                    {p.excerpt && (
                      <p className="mt-2 text-sm text-gray-300 line-clamp-3">{p.excerpt}</p>
                    )}

                    {/* tags */}
                    {p.tags && p.tags.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {p.tags.slice(0, 4).map((t) => (
                          <Link
                            key={t}
                            to={`/blog?tag=${encodeURIComponent(t)}`}
                            className="text-[11px] px-2 py-0.5 rounded-full border border-white/10 bg-white/5 text-gray-200 hover:border-white/20"
                          >
                            #{t}
                          </Link>
                        ))}
                      </div>
                    )}

                    <div className="mt-4 text-[11px] text-gray-400">
                      {(p.author || 'Nakoda Mobile')}{' '}
                      {p.publishedAt
                        ? '• ' + new Date(p.publishedAt).toLocaleDateString()
                        : ''}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          {/* pager */}
          {!loading && pageInfo.pages > 1 && (
            <div className="mt-10 flex items-center justify-center gap-3">
              <button
                onClick={() => go(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-gray-200 disabled:opacity-40 hover:border-white/20"
              >
                Prev
              </button>
              <span className="text-sm text-gray-300">
                Page {pageInfo.page} / {pageInfo.pages}
              </span>
              <button
                onClick={() => go(Math.min(pageInfo.pages, page + 1))}
                disabled={!pageInfo.hasMore}
                className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-gray-200 disabled:opacity-40 hover:border-white/20"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Blog;
