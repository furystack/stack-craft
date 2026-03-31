# Stack Craft

A web application for managing development stacks, services, prerequisites, and repositories. Built with a [FuryStack](https://github.com/furystack/furystack) backend and a [Shades](https://github.com/furystack/furystack/tree/develop/packages/shades)-based single page application.

## Features

- **Stack management** -- group related services, repositories, and prerequisites into stacks
- **Service lifecycle** -- start, stop, restart, build, and install services with real-time log streaming
- **Prerequisite checks** -- define and evaluate system prerequisites before running services
- **Repository integration** -- clone and manage GitHub repositories with branch switching
- **Environment variables** -- manage per-stack and per-service environment configuration with encrypted secrets
- **Import / Export** -- share stack configurations across environments
- **MCP server** -- interact with Stack Craft via [Model Context Protocol](https://modelcontextprotocol.io/) for AI assistant integration

## Prerequisites

- [Node.js](https://nodejs.org/) >= 22
- [Yarn](https://yarnpkg.com/) 4 (included via `packageManager` in `package.json`)
- [Docker](https://www.docker.com/) (for PostgreSQL, or provide your own instance)

## Getting Started

```bash
# Clone and install
git clone https://github.com/furystack/stack-craft.git
cd stack-craft
yarn

# Start PostgreSQL
docker compose up -d

# Create your environment file
cp .env.example .env

# Start the backend and frontend
yarn start:service   # Backend on http://localhost:9090
yarn start:frontend  # Frontend on http://localhost:8080
```

Open http://localhost:8080 in your browser. On first launch, the installer wizard will guide you through creating an admin account.

## Configuration

Environment variables can be set in the `.env` file at the project root.

| Variable                     | Default                                                      | Description                                                                                                      |
| ---------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`               | `postgres://stackcraft:stackcraft@localhost:5433/stackcraft` | PostgreSQL connection string                                                                                     |
| `APP_SERVICE_PORT`           | `9090`                                                       | Backend HTTP server port                                                                                         |
| `MCP_PORT`                   | `9091`                                                       | MCP server port                                                                                                  |
| `STACK_CRAFT_ENCRYPTION_KEY` | _(auto-generated)_                                           | Base64-encoded 256-bit key for encrypting sensitive values. If unset, a key file is created in `~/.stack-craft/` |

## Docker

Build and run the Docker image:

```bash
docker build -t stack-craft .

docker run -p 9090:9090 \
  -e DATABASE_URL=postgres://user:password@host:5432/stackcraft \
  stack-craft
```

The pre-built image is also available on Docker Hub:

```bash
docker run -p 9090:9090 \
  -e DATABASE_URL=postgres://user:password@host:5432/stackcraft \
  furystack/stack-craft
```

## Architecture

```
                          ┌──────────────────────────┐
                          │  Browser (Shades SPA)    │
                          └────────┬─────────────────┘
                                   │ REST + WebSocket
                          ┌────────▼─────────────────┐
  MCP Clients ──HTTP+SSE──▶  Node.js Service :9090   │
        :9091              │  (FuryStack REST)        │
                          └──┬──────────────┬────────┘
                             │              │
                    ┌────────▼──┐    ┌──────▼──────┐
                    │ PostgreSQL│    │ File System  │
                    │           │    │ (git, procs) │
                    └───────────┘    └─────────────┘
```

## Project Structure

```
stack-craft/
├── common/     # Shared API type definitions and models
├── frontend/   # Shades-based SPA (Vite)
├── service/    # FuryStack REST backend (Node.js)
├── docs/       # Documentation (troubleshooting, etc.)
└── e2e/        # Playwright end-to-end tests
```

See also: [frontend/README.md](frontend/README.md) for frontend-specific documentation.

## Testing

```bash
# Unit tests (Vitest)
yarn test

# End-to-end tests (requires running PostgreSQL + DATABASE_URL)
yarn test:e2e
```

## Available Scripts

| Script                | Description                                   |
| --------------------- | --------------------------------------------- |
| `yarn start:service`  | Start the backend service                     |
| `yarn start:frontend` | Start the Vite dev server for the frontend    |
| `yarn build`          | Build all packages                            |
| `yarn test`           | Run Vitest unit tests                         |
| `yarn test:e2e`       | Run Playwright E2E tests                      |
| `yarn lint`           | Run ESLint                                    |
| `yarn format`         | Format code with Prettier                     |
| `yarn create-schemas` | Regenerate JSON schemas from TypeScript types |

## MCP Server

Stack Craft includes a [Model Context Protocol](https://modelcontextprotocol.io/) server for AI assistant integration. It runs on a separate port (default `9091`) and provides tools for managing stacks, services, repositories, prerequisites, and environment variables.

**Connecting:** Point your MCP client to `http://localhost:9091/mcp` using Streamable HTTP transport with a Bearer token for authentication. Create API tokens via the UI under User Settings.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, coding standards, and the release workflow.

## Troubleshooting

See [docs/troubleshooting.md](docs/troubleshooting.md) for common issues and their resolutions.

## License

[GPL-2.0-only](LICENSE)
