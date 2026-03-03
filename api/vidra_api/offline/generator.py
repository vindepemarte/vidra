import calendar
import datetime as dt
from dataclasses import dataclass


THEMES = [
    ("Momentum Monday", "focused"),
    ("Tutorial Tuesday", "curious"),
    ("Wellness Wednesday", "balanced"),
    ("Throwback Thursday", "nostalgic"),
    ("Feature Friday", "ambitious"),
    ("Social Saturday", "playful"),
    ("Slow Sunday", "cozy"),
]

SLOTS = ["08:30", "11:00", "13:30", "16:00", "19:00", "21:30"]
SCENES = [
    "hero-post",
    "carousel-sequence",
    "story-sequence",
    "reel-concept",
    "niche-tip",
    "community-prompt",
]


@dataclass
class PostDraft:
    post_number: int
    time: str
    scene_type: str
    caption: str
    prompt: str
    hashtags: str


@dataclass
class DayDraft:
    day: int
    date: dt.date
    theme: str
    mood: str
    posts: list[PostDraft]


class OfflineCalendarEngine:
    """FREE tier engine: fully local rule-based generation with zero external API calls."""

    @staticmethod
    def generate_month(
        *,
        persona_name: str,
        niche: str,
        city: str,
        month: int,
        year: int,
    ) -> list[DayDraft]:
        _, days_in_month = calendar.monthrange(year, month)
        result: list[DayDraft] = []

        for day in range(1, days_in_month + 1):
            date_obj = dt.date(year, month, day)
            theme, mood = THEMES[date_obj.weekday()]
            posts: list[PostDraft] = []

            for idx in range(6):
                slot = SLOTS[idx]
                scene = SCENES[idx]
                caption = (
                    f"{persona_name} | {theme}. {scene.title()} moment from {city}. "
                    f"Building a consistent {niche} story, one post at a time."
                )
                prompt = (
                    f"{persona_name}, {scene} scene, {mood} mood, {city}. UGC smartphone shot, half-face or candid angle, "
                    f"natural grain, handheld slight motion blur, ambient light, friends-in-frame feel, real-world depth."
                )
                hashtags = f"#{niche.lower().replace(' ', '')} #creator #content #vidra"

                posts.append(
                    PostDraft(
                        post_number=idx + 1,
                        time=slot,
                        scene_type=scene,
                        caption=caption,
                        prompt=prompt,
                        hashtags=hashtags,
                    )
                )

            result.append(DayDraft(day=day, date=date_obj, theme=theme, mood=mood, posts=posts))

        return result
