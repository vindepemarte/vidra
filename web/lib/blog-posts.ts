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
    excerpt: "The difference between random AI images and a coherent AI influencer brand. Learn the Vidra method for persona DNA, wardrobe logic, and 30-day content calendars.",
    publishedAt: "2026-03-03",
    author: "Lexa AI",
    tags: ["guide", "persona", "strategy", "tutorial"],
    body: [
      "If you've tried creating an AI influencer, you know the problem: You generate an image. It looks good. You post it. Then you try to make another one... and she looks completely different.",
      "Random prompts ≠ brand. In this guide, I'll show you how to create an AI influencer that's actually a brand — not just a collection of random images.",
      "## What is an AI Influencer?",
      "An AI influencer is a virtual persona created with artificial intelligence that has a consistent identity, creates content regularly, builds an audience, and can monetize through sponsorships or products.",
      "Famous examples include Lil Miquela (3M followers), Imma (400K followers), and Bermuda (250K followers). These aren't random. They're brands.",
      "## Why Most AI Influencers Fail",
      "I analyzed 50+ AI influencer accounts. 90% fail because: No consistent identity, no story or personality, random content with no strategy, and no narrative arc.",
      "The 10% that succeed have consistent visual identity, clear personality and voice, content strategy, and story continuity across posts. The difference? System vs. randomness.",
      "## The Vidra Method: Persona DNA",
      "At Vidra, we built a system for this called Persona DNA. It includes Identity Memory (name, age, personality), Visual Consistency (face parameters, style), Wardrobe Logic (what she wears for different occasions), and Narrative Arc (her story, goals, journey).",
      "Without these, you're just generating random images. With them, you're building a brand.",
      "## Step-by-Step: Creating Your First AI Influencer",
      "Step 1: Define your persona DNA. Choose a name, age, city, niche, and vibe. Create a backstory. Example: Sofia, 26, Milan. Fashion & lifestyle. Elegant, bold, authentic.",
      "Step 2: Create visual parameters. Generate a base prompt that keeps her face consistent. Save it and use it for every image, only changing the setting or outfit.",
      "Step 3: Build your wardrobe. Create a system of tops, bottoms, dresses, shoes, and accessories. For each post, pick from this wardrobe instead of making up new clothes.",
      "Step 4: Plan your content calendar. Use weekly content pillars (OOTD, lifestyle, location, story, engagement) and monthly narrative arcs. This gives your content direction.",
      "Step 5: Generate 30 days of content at once. This keeps consistency, saves time, and ensures variety. At Vidra, we do this automatically.",
      "## Monetization Strategies",
      "Once you have 10K+ followers, you can earn through brand sponsorships (€100-500 per post), affiliate marketing (5-15% commission), digital products (€10-100), or your own products.",
      "## Conclusion",
      "Creating an AI influencer isn't about generating random images. It's about building a brand with consistent identity, clear personality, strategic content, and engaged community.",
      "The tools exist. The market is growing. The opportunity is now. Start building your AI influencer brand today.",
      "Built with Vidra — the AI Influencer Operating System. Try it free at vidra.life",
    ],
  },
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
