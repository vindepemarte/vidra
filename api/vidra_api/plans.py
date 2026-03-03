from dataclasses import dataclass


@dataclass(frozen=True)
class PlanDefinition:
    id: str
    name: str
    monthly_price_eur: int
    tagline: str
    outcomes: list[str]
    limits: dict[str, int]
    generation_mode: str
    included_monthly_credits: int = 0


PLAN_DEFINITIONS: dict[str, PlanDefinition] = {
    "free": PlanDefinition(
        id="free",
        name="FREE",
        monthly_price_eur=0,
        tagline="Launch your first AI creator and stay consistent every week.",
        outcomes=[
            "Unlimited calendar generations and regenerations (fair-use protected)",
            "Up to 1 persona with 7-day generation window per run",
            "Offline-only engine (no external API cost)",
            "Saved months, exports, and consistent prompt system included",
        ],
        limits={"personas": 1, "generation_days": 7},
        generation_mode="offline",
        included_monthly_credits=0,
    ),
    "pro": PlanDefinition(
        id="pro",
        name="PRO",
        monthly_price_eur=29,
        tagline="Turn content into a growth system with AI-assisted strategy.",
        outcomes=[
            "Unlimited calendar generations · regenerations rate-limited (fair-use)",
            "Up to 10 personas with 30-day generation window per run",
            "OpenRouter-enhanced strategy and stronger conversion hooks",
            "500 included monthly credits for media generation",
        ],
        limits={"personas": 10, "generation_days": 30},
        generation_mode="llm",
        included_monthly_credits=500,
    ),
    "max": PlanDefinition(
        id="max",
        name="MAX",
        monthly_price_eur=199,
        tagline="Operate a creator portfolio at agency scale.",
        outcomes=[
            "Unlimited calendar generations and regenerations (fair-use protected)",
            "Unlimited personas with 30-day generation window per run",
            "Portfolio-scale strategy with premium campaign framing",
            "2500 included monthly credits for high-output media workflows",
        ],
        limits={"personas": 9999, "generation_days": 30},
        generation_mode="llm",
        included_monthly_credits=2500,
    ),
}

PLAN_ORDER = ["free", "pro", "max"]


def normalize_tier(raw_tier: str | None) -> str:
    tier = (raw_tier or "free").strip().lower()
    if tier not in PLAN_DEFINITIONS:
        return "free"
    return tier


def personas_limit_for_tier(tier: str | None) -> int:
    return PLAN_DEFINITIONS[normalize_tier(tier)].limits["personas"]


def generation_days_for_tier(tier: str | None) -> int:
    return PLAN_DEFINITIONS[normalize_tier(tier)].limits["generation_days"]


def generation_mode_for_tier(tier: str | None) -> str:
    return PLAN_DEFINITIONS[normalize_tier(tier)].generation_mode


def included_credits_for_tier(tier: str | None) -> int:
    return PLAN_DEFINITIONS[normalize_tier(tier)].included_monthly_credits


def effective_generation_mode_for_tier(tier: str | None, *, openrouter_enabled: bool) -> str:
    policy_mode = generation_mode_for_tier(tier)
    if policy_mode == "llm" and openrouter_enabled:
        return "llm"
    return "offline"


def upgrade_target_for_tier(tier: str | None) -> str | None:
    normalized = normalize_tier(tier)
    if normalized == "free":
        return "pro"
    if normalized == "pro":
        return "max"
    return None


def serialize_plan_catalog() -> list[dict]:
    rows: list[dict] = []
    for plan_id in PLAN_ORDER:
        plan = PLAN_DEFINITIONS[plan_id]
        rows.append(
            {
                "id": plan.id,
                "name": plan.name,
                "monthly_price_eur": plan.monthly_price_eur,
                "tagline": plan.tagline,
                "outcomes": plan.outcomes,
                "limits": plan.limits,
                "generation_mode": plan.generation_mode,
                "entitlements": {
                    "calendar_generations": "unlimited_fair_use",
                    "calendar_regenerations": "unlimited_fair_use",
                    "personas_limit": plan.limits["personas"],
                    "generation_days_per_run": plan.limits["generation_days"],
                    "included_credits_monthly": plan.included_monthly_credits,
                    "media_generation_requires_credits": True,
                },
            }
        )
    return rows
