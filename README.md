# fare-terminal

Command-line installer and deployment tool for Fare Protocol custom casinos on Solana.

## Overview

`fare-terminal` automates the entire process of deploying a custom casino backend to production with zero manual infrastructure setup.

## Installation

```bash
npm install -g fare-terminal
```

Or run locally during development:

```bash
npm install
npm run build
npm link
```

## Commands

### `fareplay init <casino-name>`

Initialize and deploy a new custom casino.

**What it does:**
1. Clone custom-casino-backend repository
2. Interactive configuration wizard
3. Build TypeScript project
4. Create Fly.io app
5. Provision Redis (Upstash)
6. Provision Tigris object storage
7. Provision Postgres database
8. Set environment secrets
9. Run database migrations
10. Deploy to production

**Example:**
```bash
fareplay init my-awesome-casino
```

**Configuration prompts:**
- Solana owner wallet address
- RPC provider (mainnet/devnet/custom)
- JWT secret (auto-generate or provide)

### `fareplay deploy`

Rebuild and redeploy existing casino.

**What it does:**
1. Build TypeScript project
2. Run database migrations
3. Deploy to Fly.io using existing configuration

**Example:**
```bash
cd ~/.fare-casinos/my-awesome-casino
fareplay deploy
```

### `fareplay status`

Check deployment health and status.

**What it displays:**
- App status and hostname
- Process group health (api, ws, processor)
- Service URLs (API, WebSocket, Health)
- Quick action commands

**Example:**
```bash
cd ~/.fare-casinos/my-awesome-casino
fareplay status
```

### `fareplay logs [service]`

Stream logs from Fly.io services.

**Examples:**
```bash
# Stream all logs
fareplay logs

# Stream logs from specific process
fareplay logs api
fareplay logs ws
fareplay logs processor
```

**Available services:**
- `api` - API server logs
- `ws` - WebSocket server logs
- `processor` - Transaction processor logs

### `fareplay cleanup`

Delete all local casinos and Fly.io resources (for testing/development).

**What it destroys:**
- All local casino directories in `~/.fare-casinos`
- All Fly.io apps starting with `fare-`
- All Postgres clusters ending with `-db`
- All Redis instances ending with `-redis`

**Examples:**
```bash
# Interactive cleanup (prompts for confirmation)
fareplay cleanup

# Specify organization
fareplay cleanup --org sal-770
```

**⚠️ Warning:** This is destructive and cannot be undone! Only use during development.

## Development

### Setup

```bash
npm install
npm run build
```

### Development Mode

```bash
npm run dev -- init test-casino
```

### Watch Mode

```bash
npm run watch
```

## Project Structure

```
fare-terminal/
├── src/
│   ├── commands/         # CLI command implementations
│   │   ├── init.ts       # ✅ Initialize new casino
│   │   ├── deploy.ts     # ✅ Deploy casino
│   │   ├── status.ts     # ✅ Check deployment status
│   │   └── logs.ts       # ✅ Stream service logs
│   ├── utils/
│   │   ├── fly.ts        # ✅ Fly.io integration
│   │   ├── git.ts        # ✅ Git operations
│   │   ├── prompts.ts    # ✅ Interactive prompts
│   │   ├── config.ts     # ✅ Configuration management
│   │   ├── npm.ts        # ✅ NPM operations
│   │   ├── install.ts    # ✅ Fly CLI installation
│   │   └── banner.ts     # ✅ UI display utilities
│   ├── types/
│   │   └── index.ts      # TypeScript type definitions
│   └── index.ts          # Main CLI entry point
├── package.json
├── tsconfig.json
└── README.md
```

## Current Status

### ✅ Implemented
- Basic CLI structure with Commander.js
- `init` command with full deployment pipeline
- `deploy` command for redeployment
- `status` command for health monitoring
- `logs` command with process filtering
- Interactive configuration wizard
- Fly.io CLI integration and authentication
- Automated Fly CLI installation
- Database provisioning (Managed Postgres)
- Redis provisioning (Upstash Redis)
- Object storage provisioning (Tigris)
- Casino directory management
- Configuration file generation
- Environment file and secrets management
- Database migrations via Prisma
- Multi-process deployment (api, ws, processor)
- Health checks and monitoring
- Real-time log streaming

## Configuration

Casinos are stored in `~/.fare-casinos/<casino-name>/`

Each casino contains:
- `fareplay.config.json` - Casino metadata
- `.env` - Environment configuration
- Cloned `custom-casino-backend` repository

## Requirements

- Node.js >= 18.0.0
- Git
- Fly.io CLI (coming soon)

## License

MIT

