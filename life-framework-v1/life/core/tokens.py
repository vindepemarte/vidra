"""Token expansion system for persona consistency.

Tokens like @GIULIA.physical.face get expanded to full descriptions
from the persona YAML data, ensuring LoRA-consistent prompts.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import yaml


def load_persona_data(persona_dir: str | Path) -> dict[str, Any]:
    """Load persona.yaml from a persona directory."""
    path = Path(persona_dir) / "persona.yaml"
    if not path.exists():
        raise FileNotFoundError(f"No persona.yaml found in {persona_dir}")
    with open(path) as f:
        return yaml.safe_load(f)


def resolve_token_path(data: dict[str, Any], path_parts: list[str]) -> str:
    """Walk a dot-separated path through nested dicts to get the value."""
    current: Any = data
    for part in path_parts:
        if isinstance(current, dict):
            if part not in current:
                raise KeyError(f"Token path segment '{part}' not found. Available: {list(current.keys())}")
            current = current[part]
        else:
            raise KeyError(f"Cannot traverse into non-dict value at '{part}'")
    if not isinstance(current, str):
        raise ValueError(f"Token resolved to {type(current).__name__}, expected string. Value: {current}")
    return current


def expand_tokens(text: str, handle: str, data: dict[str, Any]) -> str:
    """Expand all @HANDLE.path.to.value tokens in text.

    Example:
        text = "@GIULIA.physical.face is beautiful"
        handle = "GIULIA"
        data = {"physical": {"face": "oval face, hazel eyes..."}}
        → "oval face, hazel eyes... is beautiful"
    """
    pattern = re.compile(rf"@{re.escape(handle)}\.([a-zA-Z0-9_.]+)")

    def replacer(match: re.Match) -> str:
        path = match.group(1).split(".")
        try:
            return resolve_token_path(data, path)
        except (KeyError, ValueError) as e:
            return f"[UNRESOLVED: @{handle}.{match.group(1)} — {e}]"

    return pattern.sub(replacer, text)


def expand_all_tokens(text: str, personas: dict[str, dict[str, Any]]) -> str:
    """Expand tokens for multiple personas.

    Args:
        text: Text containing tokens like @GIULIA.physical.face, @MARCO.physical.hair
        personas: Dict mapping handle → persona data
    """
    for handle, data in personas.items():
        text = expand_tokens(text, handle, data)
    return text


def list_available_tokens(data: dict[str, Any], prefix: str = "") -> list[str]:
    """List all available token paths in a persona data dict.

    Useful for debugging and validation.
    """
    tokens = []
    for key, value in data.items():
        path = f"{prefix}.{key}" if prefix else key
        if isinstance(value, dict):
            tokens.extend(list_available_tokens(value, path))
        elif isinstance(value, str):
            tokens.append(path)
    return tokens


def validate_persona_tokens(persona_dir: str | Path) -> dict[str, Any]:
    """Validate a persona's token coverage.

    Returns a report with available tokens and any issues.
    """
    data = load_persona_data(persona_dir)
    handle = data.get("handle", "UNKNOWN")
    tokens = list_available_tokens(data)

    # Check for critical tokens
    critical = [
        "physical.face",
        "physical.body",
        "physical.hair_default",
        "physical.skin",
    ]
    missing = [t for t in critical if t not in tokens]

    return {
        "handle": handle,
        "total_tokens": len(tokens),
        "tokens": tokens,
        "missing_critical": missing,
        "ok": len(missing) == 0,
    }
