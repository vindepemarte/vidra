"""Wardrobe combinatorics engine — intelligent outfit combination."""

from __future__ import annotations

import random
from pathlib import Path
from typing import Any

import yaml


class WardrobeEngine:
    """Combines individual wardrobe pieces into coherent outfits."""

    def __init__(self, persona_dir: str | Path) -> None:
        self.persona_dir = Path(persona_dir)
        self.wardrobe: dict[str, list[dict]] = {}
        self.shoes: list[dict] = []
        self.accessories: list[dict] = []
        self.makeup: list[dict] = []
        self.hairstyles: list[dict] = []
        self.nails: list[dict] = []
        self._used_recently: set[str] = set()
        self._load()

    def _load(self) -> None:
        """Load all wardrobe data from YAML files."""
        appearance_dir = self.persona_dir / "appearance"
        wardrobe_dir = appearance_dir / "wardrobe"

        # Load wardrobe categories
        if wardrobe_dir.exists():
            for f in wardrobe_dir.glob("*.yaml"):
                with open(f) as fh:
                    items = yaml.safe_load(fh)
                    if items:
                        # Inject category name so we know which -pic folder to look in
                        for item in items:
                            item["_category"] = f.stem
                        self.wardrobe[f.stem] = items

        # Load other style assets
        for attr, filename in [
            ("shoes", "shoes.yaml"),
            ("accessories", "accessories.yaml"),
            ("makeup", "makeup_styles.yaml"),
            ("hairstyles", "hairstyles.yaml"),
            ("nails", "nail_styles.yaml"),
        ]:
            path = appearance_dir / filename
            if path.exists():
                with open(path) as fh:
                    data = yaml.safe_load(fh)
                    if data:
                        # Inject category name for -pic folder mapping
                        for item in data:
                            item["_category"] = attr
                        setattr(self, attr, data)

    def combine_outfit(
        self,
        occasion: str = "casual",
        season: str = "spring",
        time_of_day: str = "day",
        include_makeup: bool = True,
        include_hair: bool = True,
        include_nails: bool = True,
    ) -> dict[str, Any]:
        """Combine wardrobe pieces into a coherent outfit.

        Returns a dict with all components and their prompt snippets.
        """
        outfit: dict[str, Any] = {}

        # Determine if we use a dress/suit or top+bottom
        has_dresses = "dresses" in self.wardrobe and self.wardrobe["dresses"]
        has_suits = "suits" in self.wardrobe and self.wardrobe["suits"]
        use_one_piece = random.random() < 0.4 and (has_dresses or has_suits)

        if use_one_piece:
            if has_dresses:
                outfit["main"] = self._pick_item(self.wardrobe["dresses"], occasion, season)
            elif has_suits:
                outfit["main"] = self._pick_item(self.wardrobe["suits"], occasion, season)
        else:
            # Top + bottom
            top_cats = [c for c in ["tops", "shirts"] if c in self.wardrobe]
            bottom_cats = [c for c in ["bottoms", "trousers"] if c in self.wardrobe]

            if top_cats:
                outfit["top"] = self._pick_item(self.wardrobe[top_cats[0]], occasion, season)
            if bottom_cats:
                outfit["bottom"] = self._pick_item(self.wardrobe[bottom_cats[0]], occasion, season)

        # Outerwear (seasonal)
        if season in ("fall", "winter") and "outerwear" in self.wardrobe:
            if random.random() < 0.7:
                outfit["outerwear"] = self._pick_item(
                    self.wardrobe["outerwear"], occasion, season
                )

        # Shoes
        if self.shoes:
            outfit["shoes"] = self._pick_item(self.shoes, occasion, season)

        # Accessories (pick 2-4)
        if self.accessories:
            num_acc = random.randint(2, min(4, len(self.accessories)))
            outfit["accessories"] = self._pick_multiple(
                self.accessories, occasion, num_acc
            )

        # Makeup
        if include_makeup and self.makeup:
            occasion_map = {
                "casual": "everyday",
                "formal": "formal",
                "night_out": "night_out",
                "gym": "gym",
                "date_night": "date_night",
                "brunch": "brunch",
                "cozy": "everyday",
                "content": "content_creation",
            }
            mapped_occasion = occasion_map.get(occasion, "everyday")
            outfit["makeup"] = self._pick_item(self.makeup, mapped_occasion, season)

        # Hairstyle
        if include_hair and self.hairstyles:
            outfit["hairstyle"] = self._pick_item(self.hairstyles, occasion, season)

        # Nails
        if include_nails and self.nails:
            outfit["nails"] = self._pick_item(self.nails, occasion, season)

        # Build combined prompt snippet
        outfit["prompt_snippet"] = self._build_outfit_snippet(outfit)

        # Gather local reference images
        outfit["reference_images"] = self._gather_reference_images(outfit)

        return outfit

    def _gather_reference_images(self, outfit: dict[str, Any]) -> list[str]:
        """Find local reference images (.png) for chosen items."""
        references = []
        appearance_dir = self.persona_dir / "appearance"
        
        # Check all possible components
        components_to_check = []
        if "main" in outfit: components_to_check.append(outfit["main"])
        if "top" in outfit: components_to_check.append(outfit["top"])
        if "bottom" in outfit: components_to_check.append(outfit["bottom"])
        if "outerwear" in outfit: components_to_check.append(outfit["outerwear"])
        if "shoes" in outfit: components_to_check.append(outfit["shoes"])
        if "makeup" in outfit: components_to_check.append(outfit["makeup"])
        if "hairstyle" in outfit: components_to_check.append(outfit["hairstyle"])
        if "nails" in outfit: components_to_check.append(outfit["nails"])
        if "accessories" in outfit: components_to_check.extend(outfit["accessories"])

        for item in components_to_check:
            cat = item.get("_category")
            if not cat: continue
            
            # Use id or fallback to name for matching
            name_slug = item.get("id", item.get("name", "")).replace(" ", "_").lower()
            if not name_slug: continue

            # Clean up category name map (e.g. makeup -> makeup_styles)
            cat_map = {
                "makeup": "makeup_styles",
                "nails": "nails_style", # The folder is nails_style-pic
            }
            mapped_cat = cat_map.get(cat, cat)
            
            pic_dir = appearance_dir / f"{mapped_cat}-pic"
            if pic_dir.exists():
                # Try exact filename match first if the item name literally matches a file
                for ext in [".png", ".jpg", ".jpeg"]:
                    # Just find ANY file in the directory that contains words from the name
                    for f in pic_dir.iterdir():
                        if f.is_file() and f.suffix.lower() in [".png", ".jpg", ".jpeg"]:
                            # If the file name contains key parts of the item's name/brand
                            brand_words = item.get("brand", "").lower().split()
                            brand_word = brand_words[0] if brand_words else ""
                            if brand_word and brand_word in f.name.lower():
                                references.append(str(f.absolute()))
                                break # Stop at first match for this item

        # Deduplicate and return
        return list(dict.fromkeys(references))

    def _pick_item(
        self, items: list[dict], occasion: str, season: str
    ) -> dict[str, Any]:
        """Pick the most appropriate item that hasn't been used recently."""
        # Score items by relevance
        scored = []
        for item in items:
            score = 0
            item_id = item.get("id", "")

            # Occasion match
            tags = item.get("style_tags", []) + item.get("occasion", [])
            if occasion.lower() in [t.lower() for t in tags]:
                score += 3
            # Season match
            seasons = item.get("season", [])
            if season.lower() in [s.lower() for s in seasons]:
                score += 2
            # Penalty for recently used
            if item_id in self._used_recently:
                score -= 5
            # Small random factor for variety
            score += random.uniform(0, 1.5)

            scored.append((score, item))

        scored.sort(key=lambda x: x[0], reverse=True)

        # Pick from top 3
        top_n = min(3, len(scored))
        chosen = random.choice(scored[:top_n])[1]

        # Track usage
        if chosen.get("id"):
            self._used_recently.add(chosen["id"])
            # Reset tracking after 20 items to allow re-use
            if len(self._used_recently) > 20:
                self._used_recently = set(list(self._used_recently)[-10:])

        return chosen

    def _pick_multiple(
        self, items: list[dict], occasion: str, count: int
    ) -> list[dict[str, Any]]:
        """Pick multiple non-duplicate items."""
        picked = []
        remaining = list(items)
        for _ in range(min(count, len(remaining))):
            chosen = self._pick_item(remaining, occasion, "all")
            picked.append(chosen)
            remaining = [i for i in remaining if i.get("id") != chosen.get("id")]
        return picked

    def _build_outfit_snippet(self, outfit: dict[str, Any]) -> str:
        """Build a combined prompt snippet from all outfit components."""
        parts = []

        if "main" in outfit:
            parts.append(f"wearing {outfit['main'].get('prompt_snippet', '')}")
        else:
            top_snip = outfit.get("top", {}).get("prompt_snippet", "")
            bottom_snip = outfit.get("bottom", {}).get("prompt_snippet", "")
            if top_snip and bottom_snip:
                parts.append(f"wearing {top_snip} and {bottom_snip}")
            elif top_snip:
                parts.append(f"wearing {top_snip}")

        if "outerwear" in outfit:
            parts.append(f"with {outfit['outerwear'].get('prompt_snippet', '')}")

        if "shoes" in outfit:
            parts.append(outfit["shoes"].get("prompt_snippet", ""))

        if "makeup" in outfit:
            parts.append(outfit["makeup"].get("prompt_snippet", ""))

        if "hairstyle" in outfit:
            parts.append(f"hair styled in {outfit['hairstyle'].get('prompt_snippet', '')}")

        if "nails" in outfit:
            parts.append(outfit["nails"].get("prompt_snippet", ""))

        if "accessories" in outfit:
            acc_snips = [a.get("prompt_snippet", "") for a in outfit["accessories"] if a.get("prompt_snippet")]
            if acc_snips:
                parts.append(", ".join(acc_snips[:3]))

        return ", ".join(p for p in parts if p)

    def reset_usage_tracking(self) -> None:
        """Reset the recently-used tracker (e.g., for a new month)."""
        self._used_recently.clear()
