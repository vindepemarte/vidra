import Link from "next/link";

import { getAllBlogPosts } from "@/lib/blog-posts";

export default function BlogIndexPage() {
  const posts = getAllBlogPosts();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-4 px-4 py-6 sm:px-8">
      <section className="panel p-5 sm:p-7">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/80">Vidra by Lexa AI · Blog</p>
        <h1 className="mt-2 text-3xl font-black sm:text-5xl">Insights For AI Influencer Operators</h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-200/90 sm:text-base">
          Frameworks, playbooks, and tactical guidance for persona consistency, campaign planning, and media execution.
        </p>
      </section>

      <section className="grid gap-3">
        {posts.length === 0 ? (
          <article className="panel p-5 text-sm text-slate-200">No posts yet. Publish your first article to activate the blog.</article>
        ) : (
          posts.map((post) => (
            <article key={post.slug} className="panel p-5">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                <span>{new Date(post.publishedAt).toLocaleDateString()}</span>
                <span>·</span>
                <span>{post.author}</span>
              </div>
              <h2 className="mt-2 text-2xl font-black">
                <Link href={`/blog/${post.slug}`} className="hover:text-cyan-100">
                  {post.title}
                </Link>
              </h2>
              <p className="mt-2 text-sm text-slate-200">{post.excerpt}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <span key={tag} className="rounded-md border border-cyan-300/30 bg-cyan-500/10 px-2 py-0.5 text-xs text-cyan-100">
                    {tag}
                  </span>
                ))}
              </div>
              <Link
                href={`/blog/${post.slug}`}
                className="mt-4 inline-flex items-center rounded-lg border border-cyan-300/40 px-3 py-2 text-xs font-bold text-cyan-100"
              >
                Read article
              </Link>
            </article>
          ))
        )}
      </section>
    </main>
  );
}

