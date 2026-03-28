# Stack Craft

Example web app with common type API definitions, a FuryStack-based backend service and a Shades-based single page application.

# Usage

1. Clone the repository
1. Install the dependencies with `yarn`
1. Start PostgreSQL (e.g. `docker compose up -d`)
1. Copy `.env.example` to `.env` and adjust if needed
1. Start the frontend and the backend service with `yarn start` (you can stop / start them individually, check the NPM scripts for further details)

## Docker

When running the Docker image, pass the `DATABASE_URL` environment variable:

```bash
docker run -e DATABASE_URL=postgres://user:password@host:5432/stackcraft furystack/stack-craft
```

# Testing

- You can execute the example Vitest tests with `yarn test`
- You can execute E2E tests with `yarn test:e2e` (requires a running PostgreSQL instance and `DATABASE_URL` set)
