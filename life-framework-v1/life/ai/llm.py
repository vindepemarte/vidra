"""OpenRouter LLM wrapper for structured AI generation."""

from __future__ import annotations

import json
import os
import re
import time
from typing import Any

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()


class LLM:
    """Wrapper around OpenRouter API using the OpenAI-compatible interface."""

    def __init__(self) -> None:
        api_key = os.getenv("OPENROUTER_API_KEY")
        if not api_key:
            raise ValueError("OPENROUTER_API_KEY not set in .env")
        self.model = os.getenv("OPENROUTER_MODEL", "anthropic/claude-sonnet-4-20250514")
        timeout_seconds = float(os.getenv("OPENROUTER_TIMEOUT_SECONDS", "45"))
        max_retries = int(os.getenv("OPENROUTER_MAX_RETRIES", "1"))
        self.client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=api_key,
            timeout=timeout_seconds,
            max_retries=max_retries,
        )

    def chat(
        self,
        prompt: str,
        system: str = "",
        temperature: float = 0.8,
        max_tokens: int = 4096,
    ) -> str:
        """Send a chat completion and return the text response."""
        messages: list[dict[str, str]] = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        response = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return response.choices[0].message.content or ""

    @staticmethod
    def _sanitize_json(text: str) -> str:
        """Fix common JSON issues from LLM output.

        Handles invalid escape sequences like \\e, \\a, etc.
        that cause json.loads to fail.
        """
        # Fix invalid escape sequences: replace \X where X is not a valid
        # JSON escape char (" \\ / b f n r t u) with \\X
        text = re.sub(
            r'\\(?!["\\bfnrtu/])',
            r'\\\\',
            text,
        )
        return text

    @staticmethod
    def _strip_fences(text: str) -> str:
        """Strip markdown code fences from LLM output."""
        cleaned = text.strip()
        if cleaned.startswith("```"):
            first_newline = cleaned.index("\n")
            cleaned = cleaned[first_newline + 1 :]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        return cleaned.strip()

    def generate_json(
        self,
        prompt: str,
        system: str = "",
        temperature: float = 0.7,
        max_tokens: int = 8192,
        retries: int = 2,
    ) -> Any:
        """Generate a response and parse it as JSON.

        The prompt should instruct the model to return valid JSON.
        Includes retry logic and escape sanitization for robustness.
        """
        system_with_json = (
            (system + "\n\n" if system else "")
            + "You MUST respond with valid JSON only. No markdown fences, no explanation, just the raw JSON object or array. Make sure all strings use proper JSON escaping."
        )

        last_error = None
        for attempt in range(retries + 1):
            try:
                raw = self.chat(
                    prompt, system=system_with_json, temperature=temperature, max_tokens=max_tokens
                )
                cleaned = self._strip_fences(raw)
                # Try parsing as-is first
                try:
                    return json.loads(cleaned)
                except json.JSONDecodeError:
                    # Try with sanitized escapes
                    sanitized = self._sanitize_json(cleaned)
                    return json.loads(sanitized)
            except (json.JSONDecodeError, ValueError) as e:
                last_error = e
                if attempt < retries:
                    time.sleep(0.5)
                    continue

        raise ValueError(f"Failed to parse JSON after {retries + 1} attempts: {last_error}")

    def generate_list(
        self,
        prompt: str,
        system: str = "",
        temperature: float = 0.7,
        max_tokens: int = 8192,
    ) -> list[dict[str, Any]]:
        """Generate a JSON array of objects."""
        result = self.generate_json(prompt, system, temperature, max_tokens)
        if not isinstance(result, list):
            raise ValueError(f"Expected JSON array, got {type(result).__name__}")
        return result

    def generate_yaml_content(
        self,
        prompt: str,
        system: str = "",
        temperature: float = 0.7,
        max_tokens: int = 8192,
    ) -> str:
        """Generate valid YAML content (returned as string to be saved)."""
        system_with_yaml = (
            (system + "\n\n" if system else "")
            + "You MUST respond with valid YAML only. No markdown fences, no explanation, just the raw YAML content."
        )
        raw = self.chat(
            prompt, system=system_with_yaml, temperature=temperature, max_tokens=max_tokens
        )
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            first_newline = cleaned.index("\n")
            cleaned = cleaned[first_newline + 1 :]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        return cleaned.strip()

    def generate_markdown(
        self,
        prompt: str,
        system: str = "",
        temperature: float = 0.85,
        max_tokens: int = 4096,
    ) -> str:
        """Generate rich markdown content (backstories, descriptions, etc.)."""
        return self.chat(prompt, system=system, temperature=temperature, max_tokens=max_tokens)
