export type BlogPost = {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  author: string;
  tags: string[];
  body: string[];
};

const POSTS: BlogPost[] = [
  {
    slug: "how-to-create-ai-influencer-complete-guide",
    title: "How to Create an AI Influencer: The Complete Guide (2026)",
    excerpt: "Stop generating random AI images. Build a coherent AI influencer brand with Persona DNA, Wardrobe Logic, and 30-day calendars.",
    publishedAt: "2026-03-03",
    author: "Lexa AI",
    tags: ["guide", "persona", "strategy", "tutorial"],
    // This post has a custom page at /blog/how-to-create-ai-influencer-complete-guide/page.tsx
    body: [],
  },
  {
    slug: "how-to-build-an-ai-influencer-identity-system",
    title: "How To Build An AI Influencer Identity System",
    excerpt: "Design the 5-layer identity stack that keeps persona, calendar, and media perfectly aligned.",
    publishedAt: "2026-03-03",
    author: "Lexa AI Editorial",
    tags: ["strategy", "persona", "workflow"],
    // This post has a custom page at /blog/how-to-build-an-ai-influencer-identity-system/page.tsx
    body: [],
  },
];

export function getAllBlogPosts(): BlogPost[] {
  return [...POSTS].sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
}

export function getBlogPostBySlug(slug: string): BlogPost | null {
  return POSTS.find((post) => post.slug === slug) ?? null;
}
