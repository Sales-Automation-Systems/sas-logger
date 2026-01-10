# @sas/logger

Wide events logging for SAS applications. Implements the "wide events" pattern from [loggingsucks.com](https://loggingsucks.com).

## Features

- **One event per request** - Complete context in a single log entry
- **Framework adapters** - Next.js, Express, Vercel serverless
- **Axiom integration** - High-cardinality, queryable logs
- **Tail sampling** - Always keep errors and slow requests
- **TypeScript** - Full type safety

## Installation

```bash
npm install @sas/logger
```

## Quick Start

### Next.js App Router

```typescript
// instrumentation.ts
import { initLogger } from '@sas/logger/next'

export function register() {
  initLogger({
    serviceName: 'my-app',
    // token and dataset from env vars by default
  })
}

// app/api/example/route.ts
import { withWideEvents, enrichEvent } from '@sas/logger/next'
import { NextResponse } from 'next/server'

export const GET = withWideEvents(async (req) => {
  // Add business context
  enrichEvent({
    user: { id: 'user_123', subscription: 'premium' },
    business: { action: 'fetch_data', resource: 'users' },
  })

  return NextResponse.json({ data: [] })
})
```

### Express (Railway worker)

```typescript
import express from 'express'
import { initLogger, wideEventMiddleware, enrichEvent } from '@sas/logger/express'

const app = express()

initLogger({ serviceName: 'webhook-worker' })
app.use(wideEventMiddleware())

app.post('/webhook', (req, res) => {
  enrichEvent({ business: { webhookType: 'esignatures' } })
  res.json({ ok: true })
})
```

### Vercel Serverless (Vite + Vercel)

```typescript
// api/submit-form.ts
import { withWideEvents, enrichEvent } from '@sas/logger/vercel'

export default withWideEvents(async (req, res) => {
  enrichEvent({ business: { formType: 'contact' } })
  res.json({ success: true })
})
```

## Environment Variables

```env
AXIOM_TOKEN=xapt-xxx           # Axiom API token
AXIOM_DATASET=production       # Dataset name (default: production)
SERVICE_NAME=my-app            # Service identifier
```

## Wide Event Schema

Each event contains:

```typescript
{
  event_id: "evt_abc123",
  trace_id: "trace_xyz789",
  timestamp: "2025-01-10T12:00:00Z",

  request: {
    method: "POST",
    path: "/api/checkout",
    duration_ms: 247,
    status_code: 200,
  },

  service: {
    name: "internal-tools",
    version: "1.0.0",
    environment: "production",
  },

  user: {
    id: "user_123",
    email: "user@example.com",
    subscription: "premium",
  },

  business: {
    dealId: "deal_456",
    action: "quote_sent",
  },

  outcome: "success"
}
```

## Sampling

By default, the logger uses tail sampling:

- **100%** of errors (status >= 500, thrown errors)
- **100%** of slow requests (> 2s)
- **100%** of premium/enterprise users
- **10%** of everything else

Customize with:

```typescript
initLogger({
  serviceName: 'my-app',
  shouldSample: (event) => {
    // Keep all events (no sampling)
    return true
  },
})
```

## Querying Logs

### Axiom CLI

```bash
# Install
brew install axiomhq/tap/axiom

# Query errors
axiom query "['production'] | where outcome == 'error' | limit 20"

# Query slow requests
axiom query "['production'] | where request.duration_ms > 2000"
```

### REST API

```bash
curl -X POST 'https://api.axiom.co/v1/datasets/_apl?format=tabular' \
  -H 'Authorization: Bearer $AXIOM_TOKEN' \
  -d '{"apl": "['production'] | where user.id == \"user_123\" | limit 10"}'
```

## License

MIT
