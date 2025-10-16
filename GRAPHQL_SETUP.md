# Fly.io GraphQL Integration

## Overview

This project uses Fly.io's GraphQL API for most operations, falling back to the CLI only when necessary. This gives us:

- ✅ **Full control over UI/UX** - No more interactive prompts
- ✅ **Type safety** - Auto-generated TypeScript types
- ✅ **Better performance** - Direct HTTP calls instead of spawning processes
- ✅ **Programmatic control** - Easier to handle errors and parse responses

## Setup

### Dependencies

```json
{
  "dependencies": {
    "graphql": "^16.11.0",
    "graphql-request": "^7.3.0"
  },
  "devDependencies": {
    "@graphql-codegen/cli": "^6.0.0",
    "@graphql-codegen/typescript": "^5.0.2",
    "@graphql-codegen/typescript-operations": "^5.0.2",
    "@graphql-codegen/typescript-graphql-request": "^6.3.0"
  }
}
```

### Code Generation

GraphQL types are auto-generated from the Fly.io schema:

```bash
npm run codegen
```

This fetches the latest schema from `https://api.fly.io/graphql` and generates TypeScript types in `src/generated/graphql.ts`.

## What We Can Do via GraphQL

### ✅ Fully Supported

#### App Management
- **Create apps** - `createApp` mutation
- **Get app status** - `app` query with machines, release info
- **Delete apps** - `deleteApp` mutation
- **Scale apps** - `scaleApp` mutation
- **Update apps** - Various update mutations

#### Secrets Management
- **Set secrets** - `setSecrets` mutation (no interactive prompts!)
- **Unset secrets** - `unsetSecrets` mutation

#### Database Operations
- **Attach Postgres** - `attachPostgresCluster` mutation
- **Detach Postgres** - `detachPostgresCluster` mutation
- **Create DB users** - `createPostgresClusterUser` mutation
- **Grant access** - `grantPostgresClusterUserAccess` mutation
- **List attachments** - `postgresAttachments` query

#### Add-ons
- **Create add-ons** - `createAddOn` mutation (Redis, etc.)
- **List add-ons** - `addOns` query
- **Update add-ons** - `updateAddOn` mutation
- **Delete add-ons** - `deleteAddOn` mutation

#### Machines
- **List machines** - `machines` query with state, region, etc.
- **Launch machines** - `launchMachine` mutation
- **Start/Stop machines** - `startMachine`, `stopMachine` mutations

#### Organization Management
- **Get organizations** - `viewer.organizations` query
- **Get current user** - `viewer` query

## What We Must Use CLI For

### ⚠️ CLI Required

#### Postgres Provisioning
- **Create Postgres cluster** - No GraphQL mutation available
  - Must use: `fly mpg create`
  - The GraphQL API only supports attaching existing clusters

#### Deployment
- **Build & deploy** - No direct GraphQL deployment
  - Must use: `fly deploy`
  - GraphQL has `deployImage` but it requires a pre-built image

#### Authentication
- **Login** - Interactive browser flow
  - Must use: `fly auth login`
  - We get the token after auth and use it for GraphQL

## Usage Examples

### Creating an App

```typescript
import { withFlyGraphQL } from './utils/graphql-client';

// Create app via GraphQL
const result = await withFlyGraphQL(async (sdk) => {
  return sdk.CreateApp({
    input: {
      organizationId: orgId,
      name: appName,
      machines: true,
    },
  });
});

console.log(`Created app: ${result.createApp.app.name}`);
```

### Setting Secrets

```typescript
// Set secrets via GraphQL (non-interactive!)
await withFlyGraphQL(async (sdk) => {
  return sdk.SetSecrets({
    input: {
      appId: appId,
      secrets: [
        { key: 'DATABASE_URL', value: connectionString },
        { key: 'JWT_SECRET', value: jwtSecret },
      ],
    },
  });
});
```

### Getting App Status

```typescript
const status = await withFlyGraphQL(async (sdk) => {
  return sdk.GetApp({ name: appName });
});

console.log(`App: ${status.app.name}`);
console.log(`Machines: ${status.app.machines.nodes.length}`);
```

### Creating Redis Add-on

```typescript
await withFlyGraphQL(async (sdk) => {
  return sdk.createAddOn({
    input: {
      organizationId: orgId,
      type: 'upstash_redis',
      name: `${appName}-redis`,
      planId: 'free-plan-id',
      primaryRegion: 'iad',
    },
  });
});
```

## Hybrid Approach

Our implementation uses **both** strategically:

### CLI for:
- `fly auth login` - Browser-based authentication
- `fly mpg create` - Postgres cluster provisioning
- `fly deploy` - Building and deploying
- `fly logs` - Log streaming (interactive)

### GraphQL for:
- ✅ Creating apps
- ✅ Setting secrets (non-interactive!)
- ✅ Creating Redis add-ons
- ✅ Attaching Postgres (after CLI creation)
- ✅ Getting status and machine info
- ✅ Managing users and access

## File Structure

```
cli/
├── src/
│   ├── graphql/
│   │   └── operations.graphql       # GraphQL queries/mutations
│   ├── generated/                    # Auto-generated (git-ignored)
│   │   └── graphql.ts               # TypeScript types & SDK
│   └── utils/
│       ├── graphql-client.ts        # GraphQL client wrapper
│       └── fly.ts                   # CLI wrapper utilities
├── codegen.yml                       # GraphQL Code Generator config
└── schema.json                       # Downloaded schema (git-ignored)
```

## Benefits

### Before (CLI only)
```typescript
// ❌ Interactive prompts - can't control
await executeFlyCommand(['mpg', 'create', ...]);
// User has to select tier manually

// ❌ Parsing stdout
const result = await executeFlyCommand(['secrets', 'set', ...]);
// Parse stdout to check if it worked
```

### After (GraphQL)
```typescript
// ✅ Full programmatic control
const result = await sdk.SetSecrets({ ... });
// Structured response, no parsing
// No interactive prompts!
```

## Regenerating Types

When Fly.io updates their API:

```bash
npm run codegen
```

This will:
1. Fetch the latest schema from Fly.io
2. Validate your GraphQL operations
3. Generate new TypeScript types
4. Update the SDK

## Authentication

The GraphQL client automatically:
1. Gets the current Fly auth token via `fly auth token`
2. Adds it to the `Authorization` header
3. Makes authenticated requests

No manual token management needed!

## Next Steps

With this setup, you can now refactor the provisioning functions in `src/utils/fly.ts` to use GraphQL instead of CLI commands for better reliability and UX.

