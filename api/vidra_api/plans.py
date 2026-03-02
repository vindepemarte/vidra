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


PLAN_DEFINITIONS: dict[str, PlanDefinition] = {
    "free": PlanDefinition(
        id="free",
        name="FREE",
        monthly_price_eur=0,
        tagline="Launch your first AI creator and stay consistent every week.",
        outcomes=[
            "Create 1 creator persona with complete profile",
            "Generate a 7-day content sprint in one click",
            "Get 6 posts/day with captions and prompt ideas",
            "Export your plan to markdown/json and publish anywhere",
        ],
        limits={"personas": 1, "generation_days": 7},
        generation_mode="offline",
    ),
    "pro": PlanDefinition(
        id="pro",
        name="PRO",
        monthly_price_eur=29,
        tagline="Turn content into a growth system with AI-assisted strategy.",
        outcomes=[
            "Manage up to 3 creator personas",
            "Generate full 30-day calendars with AI quality upgrade",
            "Get stronger hooks, CTAs and conversion-oriented captions",
            "Use your OpenRouter model for premium content planning",
        ],
        limits={"personas": 3, "generation_days": 30},
        generation_mode="llm",
    ),
    "max": PlanDefinition(
        id="max",
        name="MAX",
        monthly_price_eur=199,
        tagline="Operate a creator portfolio at agency scale.",
        outcomes=[
            "Manage up to 10 creator personas",
            "Advanced 30-day campaign plans with monetization angles",
            "High-intensity hooks and narrative continuity for scale",
            "Priority AI orchestration with your OpenRouter model",
        ],
        limits={"personas": 10, "generation_days": 30},
        generation_mode="llm",
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
            }
        )
    return rows
