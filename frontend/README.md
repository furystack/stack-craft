# StackCraft Frontend

Shades-based single page application for StackCraft.

## Tech Stack

- **[Shades](https://github.com/furystack/furystack/tree/develop/packages/shades)** -- FuryStack's web component framework
- **[Vite](https://vite.dev/)** -- Build tool and dev server
- **TypeScript** -- Strict mode enabled

## Development

```bash
# Start the dev server (port 8080)
yarn start

# Build for production
yarn build
```

The dev server proxies API requests to the backend on port 9090. Make sure the backend is running before starting the frontend.

## Project Structure

```
frontend/src/
├── components/       # Reusable UI components
│   ├── entity-forms/ # Form components for creating/editing entities
│   └── ...
├── pages/            # Page-level components (one per route)
│   ├── dashboard/
│   ├── services/
│   ├── stacks/
│   ├── wizards/
│   └── ...
├── services/         # Business logic and API client services
│   └── api-clients/  # Typed REST API clients
├── utils/            # Utility functions
└── index.tsx         # Application entry point
```

## Key Patterns

- **Dependency injection:** Services are accessed via `injector.getInstance(ServiceClass)`
- **Reactive state:** `useObservable` subscribes to `ObservableValue` instances from services
- **Entity sync:** Real-time data updates via WebSocket through `@furystack/entity-sync-client`
- **Routing:** `NestedRouter` with typed routes defined in `components/app-routes.tsx`
