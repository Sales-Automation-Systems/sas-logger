import type { WideEvent } from "./types";

/**
 * Default tail sampling function.
 * Implements the "always keep errors, always keep slow" pattern from loggingsucks.com.
 *
 * Rules:
 * 1. Always keep errors (100%)
 * 2. Always keep slow requests (above threshold)
 * 3. Always keep specific user tiers
 * 4. Random sample the rest
 */
export function defaultShouldSample(
  event: WideEvent,
  options: {
    /** Latency threshold in ms (default: 2000) */
    slowThresholdMs?: number;
    /** User subscriptions to always keep (default: ["enterprise"]) */
    alwaysKeepSubscriptions?: string[];
    /** Random sample rate for normal events (default: 0.1 = 10%) */
    sampleRate?: number;
  } = {},
): boolean {
  const {
    slowThresholdMs = 2000,
    alwaysKeepSubscriptions = ["enterprise", "premium"],
    sampleRate = 0.1,
  } = options;

  // Rule 1: Always keep errors
  if (event.outcome === "error") {
    return true;
  }
  if (event.request.status_code >= 500) {
    return true;
  }
  if (event.error) {
    return true;
  }

  // Rule 2: Always keep slow requests
  if (event.request.duration_ms > slowThresholdMs) {
    return true;
  }

  // Rule 3: Always keep specific user tiers
  if (
    event.user?.subscription &&
    alwaysKeepSubscriptions.includes(event.user.subscription)
  ) {
    return true;
  }

  // Rule 4: Random sample the rest
  return Math.random() < sampleRate;
}

/**
 * No sampling - keep everything.
 * Use this when you want complete observability and cost is not a concern.
 */
export function keepAll(): boolean {
  return true;
}

/**
 * Only keep errors - minimal sampling.
 * Use this for high-traffic routes where you only care about failures.
 */
export function keepOnlyErrors(event: WideEvent): boolean {
  return (
    event.outcome === "error" ||
    event.request.status_code >= 400 ||
    event.error !== undefined
  );
}
