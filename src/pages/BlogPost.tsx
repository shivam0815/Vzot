// src/pages/BlogPost.tsx
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import SEO from '../components/Layout/SEO';
import { blogService } from '../services/blogService';

type Post = {
  title: string;
  slug: string;
  excerpt?: string;
  coverImage?: string;
  tags?: string[];
  author?: string;
  contentHtml?: string;
  publishedAt?: string;
  updatedAt?: string;
  createdAt?: string;
};

const BlogPost: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      try {
        setLoading(true);
        const { post } = await blogService.getBySlug(slug);
        setPost(post);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  if (loading) return <div className="max-w-3xl mx-auto px-4 py-10">Loading…</div>;
  if (!post) return <div className="max-w-3xl mx-auto px-4 py-10">Post not found.</div>;

  const published = post.publishedAt || post.createdAt || '';
  const modified = post.updatedAt || post.publishedAt || post.createdAt || '';
  const isPublished = Boolean(post.publishedAt);
  const canonicalPath = `/blog/${post.slug}`;
  const robots = isPublished ? 'index,follow' : 'noindex,follow';

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://nakodamobile.com/' },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://nakodamobile.com/blog' },
      { '@type': 'ListItem', position: 3, name: post.title, item: `https://nakodamobile.com${canonicalPath}` },
    ],
  };

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://nakodamobile.com${canonicalPath}`,
    },
    headline: post.title,
    description: post.excerpt || undefined,
    image: post.coverImage ? [post.coverImage] : undefined,
    author: { '@type': 'Person', name: post.author || 'Nakoda Mobile' },
    publisher: {
      '@type': 'Organization',
      name: 'Nakoda Mobile',
      logo: { '@type': 'ImageObject', url: 'https://nakodamobile.com/og-default.png' },
    },
    datePublished: published ? new Date(published).toISOString() : undefined,
    dateModified: modified ? new Date(modified).toISOString() : undefined,
    url: `https://nakodamobile.com${canonicalPath}`,
    keywords: Array.isArray(post.tags) && post.tags.length ? post.tags.join(', ') : undefined,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <SEO
        title={post.title}
        description={post.excerpt || 'Nakoda blog post'}
        canonicalPath={canonicalPath}
        image={post.coverImage}
        robots={robots}
        jsonLd={[breadcrumbJsonLd, articleJsonLd]}
      />

      <section className="bg-gradient-to-r from-gray-900 to-black text-white py-16">
        <div className="max-w-4xl mx-auto px-4">
          <Link to="/blog" className="text-sm text-gray-300 underline">← Back to Blog</Link>
          <h1 className="text-4xl md:text-5xl font-bold mt-4">{post.title}</h1>
          <div className="text-sm text-gray-300 mt-3">
            {post.author || 'Nakoda Mobile'}
            {published ? ` • ${new Date(published).toLocaleDateString()}` : ''}
          </div>
        </div>
      </section>

      <article className="max-w-4xl mx-auto px-4 py-10 bg-white">
        {post.coverImage && <img src={post.coverImage} alt={post.title} className="w-full rounded-lg mb-6" />}
        {post.contentHtml ? (
          <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: post.contentHtml }} />
        ) : (
          <p>{post.excerpt}</p>
        )}
        {post.tags?.length ? (
          <div className="mt-8 flex flex-wrap gap-2">
            {post.tags.map((t) => (
              <Link key={t} to={`/blog?tag=${encodeURIComponent(t)}`} className="text-xs bg-gray-100 px-2 py-1 rounded">
                #{t}
              </Link>
            ))}
          </div>
        ) : null}
      </article>
    </div>
  );
};

export default BlogPost;
