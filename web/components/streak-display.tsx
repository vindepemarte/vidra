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

export function StreakDisplay({ streak }: StreakDisplayProps) {
  const emoji = getStreakEmoji(streak.current_streak);
  const healthStyle = getHealthColor(streak.streak_health);

  return (
    <div className="rounded-xl border border-cyan-300/25 bg-slate-950/45 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-cyan-100/75">Content Streak</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-4xl font-black">{streak.current_streak}</span>
            <span className="text-lg">{emoji}</span>
            <span className="text-sm text-slate-400">days</span>
          </div>
        </div>

        <div className={`rounded-lg border px-3 py-1 text-xs font-bold ${healthStyle}`}>
          {streak.streak_health === "active" ? "Active" : streak.streak_health === "at_risk" ? "At Risk" : "Broken"}
        </div>
      </div>

      {streak.streak_frozen && (
        <div className="mt-2 rounded-lg border border-blue-300/40 bg-blue-500/10 px-3 py-2 text-xs text-blue-100">
          ❄️ Streak frozen - protected for 24 hours
        </div>
      )}

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg border border-cyan-300/20 bg-slate-950/55 p-2">
          <p className="text-xs text-slate-400">Best</p>
          <p className="text-lg font-bold">{streak.longest_streak}</p>
        </div>
        <div className="rounded-lg border border-cyan-300/20 bg-slate-950/55 p-2">
          <p className="text-xs text-slate-400">Total</p>
          <p className="text-lg font-bold">{streak.total_active_days}</p>
        </div>
        <div className="rounded-lg border border-cyan-300/20 bg-slate-950/55 p-2">
          <p className="text-xs text-slate-400">Next</p>
          <p className="text-lg font-bold">{streak.next_milestone || "—"}</p>
        </div>
      </div>

      {streak.next_milestone && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>Progress to {streak.next_milestone}-day milestone</span>
            <span>{streak.current_streak}/{streak.next_milestone}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-900/70">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-lime-400 transition-all duration-500"
              style={{ width: `${Math.min(100, (streak.current_streak / streak.next_milestone) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {streak.recent_milestones.length > 0 && (
        <div className="mt-4">
          <p className="text-xs uppercase tracking-wide text-cyan-100/75 mb-2">Recent Achievements</p>
          <div className="space-y-2">
            {streak.recent_milestones.slice(0, 3).map((m, i) => (
              <div
                key={i}
                className="rounded-lg border border-lime-300/30 bg-lime-500/10 px-3 py-2 text-xs text-lime-100 flex items-center justify-between"
              >
                <span>{m.reward?.title || `${m.value}-Day ${m.type}`}</span>
                {m.reward?.credits ? (
                  <span className="font-bold">+{m.reward.credits} credits</span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
