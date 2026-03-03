import Link from "next/link";

const features = [
  {
    icon: "🧬",
    title: "Persona DNA",
    description: "Define who your AI influencer is — name, age, city, personality, backstory, values. This drives every piece of content.",
  },
  {
    icon: "👗",
    title: "Wardrobe Logic",
    description: "Upload clothing items and Vidra creates intelligent outfit combinations. No more random clothes that don't match.",
  },
  {
    icon: "📖",
    title: "Narrative Arcs",
    description: "Plan story continuity across weeks. Your AI influencer isn't just posting selfies — she's living a story.",
  },
  {
    icon: "📅",
    title: "30-Day Calendars",
    description: "Generate 180 posts with coherent themes, consistent timing, and narrative flow. Each post connects to the next.",
  },
  {
    icon: "✨",
    title: "Higgsfield Prompts",
    description: "Get production-ready prompts optimized for Higgsfield, Midjourney, DALL-E. Not generic — specific and technical.",
  },
];

const steps = [
  {
    number: "01",
    title: "Create Persona DNA",
    time: "5 min",
    description: "Define your AI influencer's identity, personality, niche, and story.",
    details: [
      "Name, age, city, background",
      "3-5 personality traits",
      "Content niche focus",
      "Backstory and current goals",
    ],
  },
  {
    number: "02",
    title: "Build Your Wardrobe",
    time: "10 min",
    description: "Upload clothing items with style tags and occasion matching.",
    details: [
      "Tops, bottoms, dresses, shoes",
      "Style rules and preferences",
      "Auto-outfit combinations",
      "Prompt-ready snippets",
    ],
  },
  {
    number: "03",
    title: "Plan Narrative Arc",
    time: "2 min",
    description: "Choose a storyline that gives your content emotional direction.",
    details: [
      "7-day or 30-day arcs",
      "Daily themes and moods",
      "Story progression",
      "Engagement hooks",
    ],
  },
  {
    number: "04",
    title: "Generate Calendar",
    time: "30 sec",
    description: "One click generates 180 posts with full context and prompts.",
    details: [
      "6 posts per day × 30 days",
      "2 stories per day",
      "Themed content pillars",
      "Optimized posting times",
    ],
  },
  {
    number: "05",
    title: "Export & Create",
    time: "Instant",
    description: "Copy production-ready prompts and generate your content.",
    details: [
      "Higgsfield-optimized prompts",
      "Full scene descriptions",
      "Wardrobe integration",
      "Technical specs included",
    ],
  },
];

const tiers = [
  {
    name: "FREE",
    price: "€0",
    period: "forever",
    highlight: false,
    features: [
      "1 persona",
      "7-day calendar generation",
      "Unlimited regeneration",
      "Offline engine (no API costs)",
      "Export to Markdown, JSON, CSV",
      "Basic prompt optimization",
    ],
  },
  {
    name: "PRO",
    price: "€29",
    period: "/month",
    highlight: true,
    badge: "Most Popular",
    features: [
      "10 personas",
      "30-day calendar generation",
      "AI-enhanced strategy (OpenRouter)",
      "500 monthly credits",
      "Advanced prompt optimization",
      "Priority support",
    ],
  },
  {
    name: "MAX",
    price: "€199",
    period: "/month",
    highlight: false,
    features: [
      "Unlimited personas",
      "30-day calendar generation",
      "2500 monthly credits",
      "Agency-scale features",
      "Premium campaign framing",
      "White-label options (soon)",
    ],
  },
];

const examplePersona = `Name: Sofia Rossi
Age: 26
City: Milan, Italy
Niche: Fashion & Lifestyle
Vibe: Elegant, Bold, Authentic

Backstory: Former fashion design student 
who dropped out to start her own brand. 
Now building her label while documenting 
the journey.

Current Focus: Launching first capsule
Goals: Open a boutique in Brera district`;

const examplePrompt = `26-year-old Italian woman, long dark 
brown hair, hazel eyes, olive skin, 
oval face, slim athletic build. 
Elegant fashion style, confident expression.

Wearing: Cream blazer over white silk 
blouse, high-waisted jeans, minimal 
gold jewelry.

Scene: Modern Milan cafe interior, 
morning light through large windows, 
sitting at marble table with coffee 
and journal, thoughtful expression.

Technical: Canon EOS R5, 85mm lens, 
f/2.0, natural lighting, shallow depth 
of field, professional fashion 
photography, high detail.`;

const exampleDay = `Day 1 of "New Beginning" Arc
Theme: Fresh Start
Mood: Hopeful

Posts:
  07:30 - Mirror selfie (getting ready)
  10:00 - Cafe content (planning, journaling)
  12:30 - OOTD (new beginnings outfit)
  15:00 - Working (focused, determined)
  18:00 - Golden hour (reflection)
  21:00 - Cozy evening (reading)

Stories:
  09:00 - Morning routine
  20:00 - Day recap

Outfit: Cream blazer + high-waisted 
jeans + white sneakers`;

export default function BlogPostPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-8">
      
      {/* Hero Section */}
      <section className="panel p-6 sm:p-10">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-100">
          <span>📖</span>
          <span>Complete Guide</span>
        </div>
        
        <h1 className="text-3xl font-black sm:text-5xl lg:text-6xl">
          How to Create an{" "}
          <span className="bg-gradient-to-r from-cyan-300 via-blue-400 to-purple-400 bg-clip-text text-transparent">
            AI Influencer
          </span>
        </h1>
        
        <p className="mt-4 max-w-3xl text-base text-slate-300 sm:text-lg">
          Stop generating random AI images. Build a <strong className="text-white">coherent AI influencer brand</strong> with Persona DNA, Wardrobe Logic, and 30-day content calendars. This is how Vidra makes it possible.
        </p>
        
        <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-slate-400">
          <div className="flex items-center gap-2">
            <span>📅</span>
            <span>March 3, 2026</span>
          </div>
          <span>·</span>
          <div className="flex items-center gap-2">
            <span>⏱️</span>
            <span>12 min read</span>
          </div>
          <span>·</span>
          <div className="flex items-center gap-2">
            <span>💜</span>
            <span>Lexa AI</span>
          </div>
        </div>
      </section>

      {/* The Problem */}
      <section className="panel p-6 sm:p-8">
        <h2 className="flex items-center gap-3 text-xl font-bold sm:text-2xl">
          <span className="text-2xl">⚠️</span>
          The Problem With Most AI Influencers
        </h2>
        
        <p className="mt-4 text-slate-300">
          You've seen them. AI-generated faces on Instagram. They get a few hundred likes, then disappear. <strong className="text-white">Why?</strong> Because they're not brands — they're random images.
        </p>
        
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="subpanel p-4 border-red-400/30 bg-red-500/5">
            <div className="flex items-center gap-2 text-sm font-bold text-red-300">
              <span>❌</span>
              <span>Failed AI Influencers</span>
            </div>
            <ul className="mt-3 space-y-2 text-sm text-slate-400">
              <li>• Random prompts, no direction</li>
              <li>• No identity memory</li>
              <li>• Inconsistent visuals</li>
              <li>• No story continuity</li>
            </ul>
          </div>
          
          <div className="subpanel p-4 border-emerald-400/30 bg-emerald-500/5">
            <div className="flex items-center gap-2 text-sm font-bold text-emerald-300">
              <span>✅</span>
              <span>Successful AI Influencers</span>
            </div>
            <ul className="mt-3 space-y-2 text-sm text-slate-400">
              <li>• Systematic content generation</li>
              <li>• Identity memory & consistency</li>
              <li>• Visual brand coherence</li>
              <li>• Narrative arcs & story flow</li>
            </ul>
          </div>
        </div>
        
        <p className="mt-6 text-slate-300">
          The difference isn't image quality. It's the <strong className="text-cyan-300">system behind them</strong>.
        </p>
      </section>

      {/* What Vidra Does */}
      <section className="panel p-6 sm:p-8">
        <h2 className="flex items-center gap-3 text-xl font-bold sm:text-2xl">
          <span className="text-2xl">🚀</span>
          What Vidra Does Differently
        </h2>
        
        <p className="mt-4 text-slate-300">
          Vidra isn't another image generator. It's an <strong className="text-white">AI Influencer Operating System</strong>.
        </p>
        
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div key={feature.title} className="subpanel p-4 transition-all hover:border-cyan-400/40">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{feature.icon}</span>
                <span className="font-bold text-white">{feature.title}</span>
              </div>
              <p className="mt-2 text-sm text-slate-400">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Step by Step Roadmap */}
      <section className="panel p-6 sm:p-8">
        <h2 className="flex items-center gap-3 text-xl font-bold sm:text-2xl">
          <span className="text-2xl">🗺️</span>
          Step-by-Step Roadmap
        </h2>
        
        <p className="mt-4 text-slate-300">
          Build your AI influencer brand in 5 simple steps:
        </p>
        
        <div className="mt-6 space-y-4">
          {steps.map((step, index) => (
            <div key={step.number} className="subpanel p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-500/20 text-lg font-black text-cyan-300">
                  {step.number}
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-bold text-white">{step.title}</h3>
                    <span className="rounded-full border border-slate-600 bg-slate-800/50 px-2 py-0.5 text-xs text-slate-400">
                      ⏱️ {step.time}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-400">{step.description}</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {step.details.map((detail) => (
                      <div key={detail} className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="text-cyan-400">→</span>
                        <span>{detail}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Example: Persona DNA */}
      <section className="panel p-6 sm:p-8">
        <h2 className="flex items-center gap-3 text-xl font-bold sm:text-2xl">
          <span className="text-2xl">🧬</span>
          Example: Persona DNA
        </h2>
        
        <p className="mt-4 text-slate-300">
          This takes 5 minutes and shapes everything that follows:
        </p>
        
        <div className="mt-6 data-scroll font-mono text-xs text-slate-300 sm:text-sm">
          <pre className="whitespace-pre-wrap">{examplePersona}</pre>
        </div>
        
        <p className="mt-4 text-sm text-slate-400">
          This isn't just a profile — it's the foundation for <strong className="text-white">180+ posts</strong> that feel like they come from a real person.
        </p>
      </section>

      {/* Example: Calendar Day */}
      <section className="panel p-6 sm:p-8">
        <h2 className="flex items-center gap-3 text-xl font-bold sm:text-2xl">
          <span className="text-2xl">📅</span>
          Example: Calendar Day
        </h2>
        
        <p className="mt-4 text-slate-300">
          One click generates structured, themed content:
        </p>
        
        <div className="mt-6 data-scroll font-mono text-xs text-slate-300 sm:text-sm">
          <pre className="whitespace-pre-wrap">{exampleDay}</pre>
        </div>
      </section>

      {/* Example: Generated Prompt */}
      <section className="panel p-6 sm:p-8">
        <h2 className="flex items-center gap-3 text-xl font-bold sm:text-2xl">
          <span className="text-2xl">✨</span>
          Example: Production-Ready Prompt
        </h2>
        
        <p className="mt-4 text-slate-300">
          Vidra generates Higgsfield-optimized prompts with all the details:
        </p>
        
        <div className="mt-6 data-scroll font-mono text-xs text-slate-300 sm:text-sm">
          <pre className="whitespace-pre-wrap">{examplePrompt}</pre>
        </div>
        
        <p className="mt-4 text-sm text-slate-400">
          Copy into Higgsfield, generate the image, and it <strong className="text-white">matches your persona perfectly</strong>.
        </p>
      </section>

      {/* Pricing Tiers */}
      <section className="panel p-6 sm:p-8">
        <h2 className="flex items-center gap-3 text-xl font-bold sm:text-2xl">
          <span className="text-2xl">💎</span>
          What You Get With Vidra
        </h2>
        
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {tiers.map((tier) => (
            <div 
              key={tier.name} 
              className={`subpanel p-5 ${tier.highlight ? 'border-cyan-400/50 bg-cyan-500/5' : ''}`}
            >
              {tier.badge && (
                <div className="mb-3 inline-block rounded-full bg-gradient-to-r from-cyan-500 to-purple-500 px-3 py-1 text-xs font-bold text-white">
                  {tier.badge}
                </div>
              )}
              
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black text-white">{tier.price}</span>
                <span className="text-sm text-slate-500">{tier.period}</span>
              </div>
              
              <div className="mt-1 text-lg font-bold text-slate-300">{tier.name}</div>
              
              <ul className="mt-4 space-y-2">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-slate-400">
                    <span className="mt-0.5 text-cyan-400">✓</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="panel border-cyan-400/30 bg-gradient-to-br from-cyan-500/10 to-purple-500/10 p-6 sm:p-10 text-center">
        <h2 className="text-2xl font-black sm:text-3xl">
          Ready to Build Your AI Influencer Brand?
        </h2>
        
        <p className="mx-auto mt-4 max-w-2xl text-slate-300">
          Stop generating random images. Start building a coherent brand with Persona DNA, Wardrobe Logic, and 30-day calendars.
        </p>
        
        <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
          <Link 
            href="https://vidra.life" 
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-cyan-500/25 transition-all hover:shadow-xl hover:shadow-cyan-500/30"
          >
            <span>🚀</span>
            <span>Start Free at Vidra.life</span>
          </Link>
          
          <span className="text-sm text-slate-500">No credit card required</span>
        </div>
        
        <p className="mt-6 text-sm text-slate-500">
          The AI influencer market is growing. The tools are here. The opportunity is now.
        </p>
      </section>

      {/* Back Link */}
      <Link href="/blog" className="mx-auto inline-flex items-center gap-2 rounded-lg border border-cyan-300/40 px-4 py-2 text-xs font-bold text-cyan-100 transition-all hover:border-cyan-300/60">
        <span>←</span>
        <span>Back to blog</span>
      </Link>
      
    </main>
  );
}
