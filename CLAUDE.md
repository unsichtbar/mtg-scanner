This is an application for scanning Magic: The Gathering cards. It keeps inventory of what cards a person has. Cards can be searched by name, by color, by mana cost, by description, and so on.

It allows for building decks for the official game formats: standard and commander.

Commander consists of 100 cards. Cards must be unique, no duplicates (but duplicate lands are allowed).

Standard consists of at least 60 cards. Cards are allowed duplicates up to a maximum of 4.

## Development

### Stack
- **Backend**: NestJS + MikroORM + PostgreSQL
- **Web**: Vite + React + Tailwind CSS v4
- **Mobile**: React Native + Expo
- **Shared**: `@mtg-scanner/shared` for cross-platform types and utilities
- **Package manager**: pnpm workspaces

### Running locally

```bash
pnpm dev:local
```

This starts:
1. PostgreSQL via Docker Compose
2. NestJS backend on http://localhost:3000 (all routes prefixed `/api`)
3. Vite web app on http://localhost:5173

### Styling
Use Tailwind CSS utility classes for all UI. Do not use inline styles or CSS modules.

### Database
MikroORM with PostgreSQL. After changing entities, generate a migration:

```bash
pnpm --filter @mtg-scanner/backend exec mikro-orm migration:create
```