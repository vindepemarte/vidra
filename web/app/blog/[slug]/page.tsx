import Link from "next/link";
import { notFound } from "next/navigation";

import { getAllBlogPosts, getBlogPostBySlug } from "@/lib/blog-posts";

export function generateStaticParams() {
  return getAllBlogPosts().map((post) => ({ slug: post.slug }));
}

export default function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = getBlogPostBySlug(params.slug);
  if (!post) {
    notFound();
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-4 px-4 py-6 sm:px-8">
      <article className="panel p-5 sm:p-7">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/80">Vidra by Lexa AI · Blog</p>
        <h1 className="mt-2 text-3xl font-black sm:text-5xl">{post.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-300">
          <span>{new Date(post.publishedAt).toLocaleDateString()}</span>
          <span>·</span>
          <span>{post.author}</span>
        </div>

        <div className="mt-6 space-y-4 text-sm leading-relaxed text-slate-100 sm:text-base">
          {post.body.map((paragraph, index) => (
            <p key={`${post.slug}-${index}`}>{paragraph}</p>
          ))}
        </div>

        <Link href="/blog" className="mt-7 inline-flex items-center rounded-lg border border-cyan-300/40 px-3 py-2 text-xs font-bold text-cyan-100">
          Back to blog
        </Link>
      </article>
    </main>
  );
}

