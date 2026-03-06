"use client";

interface StreakData {
  current_streak: number;
  longest_streak: number;
  total_active_days: number;
  last_activity_date: string | null;
  streak_frozen: boolean;
  streak_health: string;
  next_milestone: number | null;
  recent_milestones: Array<{
    type: string;
    value: number;
    achieved_at: string;
    reward: { credits?: number; title?: string };
  }>;
  milestone_reward_available: boolean;
}

interface StreakDisplayProps {
  streak: StreakData;
}

const STREAK_EMOJIS: Record<number, string> = {
  1: "🔥",
  3: "⚡",
  7: "💪",
  14: "🌟",
  21: "🚀",
  30: "👑",
  60: "💎",
  90: "🏆",
  180: "🎊",
  365: "♾️",
};

function getStreakEmoji(streak: number): string {
  const thresholds = Object.keys(STREAK_EMOJIS)
    .map(Number)
    .sort((a, b) => b - a);
  for (const threshold of thresholds) {
    if (streak >= threshold) return STREAK_EMOJIS[threshold];
  }
  return "🔥";
}

function getHealthColor(health: string): string {
  switch (health) {
    case "active":
      return "border-lime-300/70 bg-lime-500/15 text-lime-100";
    case "at_risk":
      return "border-amber-300/70 bg-amber-500/15 text-amber-100";
    default:
      return "border-red-300/70 bg-red-500/15 text-red-100";
  }
}

function getHealthLabel(health: string): string {
  switch (health) {
    case "active":
      return "Active streak";
    case "at_risk":
      return "Streak at risk - log in today to maintain";
    default:
      return "Streak broken - start a new streak today";
  }
}

export function StreakDisplay({ streak }: StreakDisplayProps) {
  const emoji = getStreakEmoji(streak.current_streak);
  const healthStyle = getHealthColor(streak.streak_health);
  const healthLabel = getHealthLabel(streak.streak_health);
  const progressPercent = streak.next_milestone
    ? Math.min(100, (streak.current_streak / streak.next_milestone) * 100)
    : 0;

  return (
    <section
      className="rounded-xl border border-cyan-300/25 bg-slate-950/45 p-4"
      aria-label={`Content streak: ${streak.current_streak} days`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-cyan-100/75">Content Streak</p>
          <div className="mt-1 flex items-baseline gap-2" aria-label={`${streak.current_streak} day streak`}>
            <span className="text-4xl font-black" aria-hidden="true">{streak.current_streak}</span>
            <span className="text-lg" aria-hidden="true">{emoji}</span>
            <span className="text-sm text-slate-400">days</span>
          </div>
          <span className="sr-only">{streak.current_streak} day content streak</span>
        </div>

        <div
          className={`rounded-lg border px-3 py-1 text-xs font-bold ${healthStyle}`}
          role="status"
          aria-label={healthLabel}
        >
          {streak.streak_health === "active" ? "Active" : streak.streak_health === "at_risk" ? "At Risk" : "Broken"}
        </div>
      </div>

      {streak.streak_frozen && (
        <div
          className="mt-2 rounded-lg border border-blue-300/40 bg-blue-500/10 px-3 py-2 text-xs text-blue-100"
          role="status"
          aria-live="polite"
        >
          ❄️ Streak frozen - protected for 24 hours
        </div>
      )}

      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg border border-cyan-300/20 bg-slate-950/55 p-2">
          <dt className="text-xs text-slate-400">Best</dt>
          <dd className="text-lg font-bold" aria-label={`Longest streak: ${streak.longest_streak} days`}>
            {streak.longest_streak}
          </dd>
        </div>
        <div className="rounded-lg border border-cyan-300/20 bg-slate-950/55 p-2">
          <dt className="text-xs text-slate-400">Total</dt>
          <dd className="text-lg font-bold" aria-label={`Total active days: ${streak.total_active_days}`}>
            {streak.total_active_days}
          </dd>
        </div>
        <div className="rounded-lg border border-cyan-300/20 bg-slate-950/55 p-2">
          <dt className="text-xs text-slate-400">Next</dt>
          <dd className="text-lg font-bold" aria-label={streak.next_milestone ? `Next milestone: ${streak.next_milestone} days` : "No next milestone"}>
            {streak.next_milestone || "—"}
          </dd>
        </div>
      </dl>

      {streak.next_milestone && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span id="progress-label">Progress to {streak.next_milestone}-day milestone</span>
            <span aria-label={`${streak.current_streak} of ${streak.next_milestone} days`}>
              {streak.current_streak}/{streak.next_milestone}
            </span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-slate-900/70"
            role="progressbar"
            aria-labelledby="progress-label"
            aria-valuenow={streak.current_streak}
            aria-valuemin={0}
            aria-valuemax={streak.next_milestone}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-lime-400 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {streak.recent_milestones.length > 0 && (
        <div className="mt-4">
          <p className="text-xs uppercase tracking-wide text-cyan-100/75 mb-2">Recent Achievements</p>
          <ul className="space-y-2" role="list" aria-label="Recent streak achievements">
            {streak.recent_milestones.slice(0, 3).map((m, i) => (
              <li
                key={i}
                className="rounded-lg border border-lime-300/30 bg-lime-500/10 px-3 py-2 text-xs text-lime-100 flex items-center justify-between"
              >
                <span>{m.reward?.title || `${m.value}-Day ${m.type}`}</span>
                {m.reward?.credits ? (
                  <span className="font-bold" aria-label={`${m.reward.credits} credits earned`}>
                    +{m.reward.credits} credits
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
