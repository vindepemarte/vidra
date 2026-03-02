import { API_URL } from "@/lib/api";

const COOKIE_PREFS_KEY = "vidra_cookie_preferences";

function analyticsConsentGranted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(COOKIE_PREFS_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { analytics?: boolean };
    return Boolean(parsed.analytics);
  } catch {
    return false;
  }
}

export async function trackEvent(
  eventName: string,
  payload: Record<string, unknown> = {},
  accessToken?: string,
  options?: { allowWithoutConsent?: boolean }
): Promise<void> {
  const allowWithoutConsent = Boolean(options?.allowWithoutConsent);
  if (!allowWithoutConsent && !analyticsConsentGranted()) {
    return;
  }

  try {
    await fetch(`${API_URL}/api/events/track`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
      },
      body: JSON.stringify({
        event_name: eventName,
        payload
      })
    });
  } catch {
    // Analytics must never block product flows.
  }
}
