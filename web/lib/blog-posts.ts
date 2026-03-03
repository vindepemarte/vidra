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
    slug: "how-to-build-an-ai-influencer-identity-system",
    title: "How To Build An AI Influencer Identity System",
    excerpt: "Set up a persona memory stack that keeps visuals, narrative, and monthly content output consistent.",
    publishedAt: "2026-03-03",
    author: "Lexa AI Editorial",
    tags: ["strategy", "persona", "workflow"],
    body: [
      "Most creator teams fail because they treat prompts like one-off tasks. Real growth comes from identity systems, not random outputs.",
      "In Vidra, identity starts with profile DNA: narrative arc, style cues, world events, and a master prompt blueprint.",
      "Then planning compounds. Monthly calendars should pull from persona memory and event context so every post pushes the same story forward.",
      "When media prompts are grounded in narrative + style + world, audience trust goes up because the feed feels human and coherent.",
      "If you want sustainable output, design the system first. Content volume only works when consistency is locked.",
    ],
  },
];

export function getAllBlogPosts(): BlogPost[] {
  return [...POSTS].sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
}

export function getBlogPostBySlug(slug: string): BlogPost | null {
  return POSTS.find((post) => post.slug === slug) ?? null;
}

