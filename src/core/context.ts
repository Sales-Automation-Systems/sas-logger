import { AsyncLocalStorage } from "async_hooks";
import type { WideEvent, EnrichmentData } from "./types";

/**
 * AsyncLocalStorage for request-scoped wide event context.
 * This allows any code in the request chain to enrich the event
 * without passing it explicitly through function parameters.
 */
export const eventStorage = new AsyncLocalStorage<WideEvent>();

/**
 * Get the current wide event from context.
 * Returns undefined if called outside a request context.
 */
export function getCurrentEvent(): WideEvent | undefined {
  return eventStorage.getStore();
}

/**
 * Enrich the current wide event with additional data.
 * This is the primary way handlers add business context.
 *
 * @example
 * ```ts
 * enrichEvent({
 *   user: { id: user.id, email: user.email },
 *   business: { dealId: "deal_123", action: "quote_sent" }
 * })
 * ```
 */
export function enrichEvent(data: EnrichmentData): void {
  const event = eventStorage.getStore();
  if (!event) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[@sas/logger] enrichEvent called outside request context. Data will be lost.",
      );
    }
    return;
  }

  // Merge user data
  if (data.user) {
    event.user = { ...event.user, ...data.user };
  }

  // Merge business data
  if (data.business) {
    event.business = { ...event.business, ...data.business };
  }

  // Merge performance data
  if (data.performance) {
    event.performance = { ...event.performance, ...data.performance };
  }

  // Merge feature flags
  if (data.feature_flags) {
    event.feature_flags = { ...event.feature_flags, ...data.feature_flags };
  }
}

/**
 * Set the error on the current wide event.
 * Automatically sets outcome to "error".
 */
export function setEventError(error: Error, retriable = false): void {
  const event = eventStorage.getStore();
  if (!event) return;

  event.outcome = "error";
  event.error = {
    type: error.name || "Error",
    message: error.message,
    stack: error.stack,
    retriable,
  };
}

/**
 * Generate a unique event ID.
 */
export function generateEventId(): string {
  return `evt_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

/**
 * Generate a trace ID (can be passed from upstream or generated fresh).
 */
export function generateTraceId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}
