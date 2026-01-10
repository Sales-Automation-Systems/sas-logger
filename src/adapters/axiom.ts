import type { WideEvent, WideEventConfig } from "../core/types";

/**
 * Axiom transport adapter.
 * Handles sending wide events to Axiom's ingest API.
 */
export class AxiomAdapter {
  private dataset: string;
  private token: string;
  private debug: boolean;
  private baseUrl = "https://api.axiom.co";
  private pendingEvents: WideEvent[] = [];
  private flushTimeout: NodeJS.Timeout | null = null;

  constructor(config: WideEventConfig) {
    this.dataset = config.dataset || process.env.AXIOM_DATASET || "production";
    this.token = config.token || process.env.AXIOM_TOKEN || "";
    this.debug = config.debug || false;

    if (!this.token && process.env.NODE_ENV === "production") {
      console.warn(
        "[@sas/logger] AXIOM_TOKEN not set. Events will not be sent to Axiom.",
      );
    }
  }

  /**
   * Queue an event for sending. Uses batching for efficiency.
   */
  send(event: WideEvent): void {
    if (this.debug) {
      console.log("[@sas/logger] Event:", JSON.stringify(event, null, 2));
    }

    if (!this.token) {
      // No token - just log locally in development
      if (process.env.NODE_ENV === "development") {
        console.log(
          `[@sas/logger] [${event.outcome}] ${event.request.method} ${event.request.path} - ${event.request.duration_ms}ms`,
        );
      }
      return;
    }

    this.pendingEvents.push(event);

    // Batch sends - flush after a short delay or when batch is full
    if (this.pendingEvents.length >= 10) {
      this.flush();
    } else if (!this.flushTimeout) {
      this.flushTimeout = setTimeout(() => this.flush(), 100);
    }
  }

  /**
   * Send all pending events to Axiom immediately.
   * Call this before the request ends in serverless environments.
   */
  async flush(): Promise<void> {
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }

    if (this.pendingEvents.length === 0) {
      return;
    }

    if (!this.token) {
      this.pendingEvents = [];
      return;
    }

    const events = this.pendingEvents;
    this.pendingEvents = [];

    try {
      const response = await fetch(
        `${this.baseUrl}/v1/datasets/${this.dataset}/ingest`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(events),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `[@sas/logger] Failed to send to Axiom: ${response.status} ${errorText}`,
        );

        // Log rate limit info if present
        const remaining = response.headers.get("X-IngestLimit-Remaining");
        if (remaining) {
          console.warn(
            `[@sas/logger] Axiom ingest limit remaining: ${remaining}`,
          );
        }
      } else if (this.debug) {
        console.log(`[@sas/logger] Sent ${events.length} events to Axiom`);
      }
    } catch (error) {
      console.error("[@sas/logger] Error sending to Axiom:", error);
      // Don't re-queue events to avoid infinite loops
    }
  }
}

// Singleton instance for convenience
let defaultAdapter: AxiomAdapter | null = null;

/**
 * Get or create the default Axiom adapter.
 */
export function getAxiomAdapter(config?: WideEventConfig): AxiomAdapter {
  if (!defaultAdapter && config) {
    defaultAdapter = new AxiomAdapter(config);
  }
  if (!defaultAdapter) {
    throw new Error(
      "[@sas/logger] AxiomAdapter not initialized. Call initLogger first.",
    );
  }
  return defaultAdapter;
}

/**
 * Initialize the default Axiom adapter.
 */
export function initAxiomAdapter(config: WideEventConfig): AxiomAdapter {
  defaultAdapter = new AxiomAdapter(config);
  return defaultAdapter;
}
