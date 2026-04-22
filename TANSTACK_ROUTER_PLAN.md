# TanStack Router Migration Plan

Migrating from `react-router-dom` to `@tanstack/react-router` using file-based routing with the Vite plugin.

## How it works

The Vite plugin watches `src/routes/` and auto-generates `src/routeTree.gen.ts`. Each file in `routes/` exports a `Route` object. The filename determines the path — `decks.$id.tsx` → `/decks/$id`.

## Steps

- [x] **1. Swap dependencies**
  - Remove `react-router-dom`, `@types/react-router-dom`
  - Add `@tanstack/react-router`, `@tanstack/router-plugin`

- [x] **2. Update `vite.config.ts`**
  - Add `tanstackRouter()` to the plugins array (must go before the React plugin)

- [x] **3. Update `src/main.tsx`**
  - Import `routeTree` from the generated `./routeTree.gen`
  - Create router instance with `createRouter({ routeTree })`
  - Register router type globally (`declare module '@tanstack/react-router'`)
  - Render `<RouterProvider router={router} />`

- [x] **4. Create `src/routes/__root.tsx`**
  - `createRootRoute` with the nav layout component + `<Outlet />`
  - Nav uses TanStack's `Link` with `className={({ isActive }) => ...}` (same ergonomics as NavLink)
  - This replaces `App.tsx`'s `BrowserRouter` + nav

- [x] **5. Create route files in `src/routes/`**
  - `index.tsx` → `/` (Scanner)
  - `inventory.tsx` → `/inventory` — defines search schema `{ set?: string }` here
  - `cards.tsx` → `/cards`
  - `finance.tsx` → `/finance`
  - `decks.tsx` → `/decks`
  - `decks.$id.tsx` → `/decks/$id`
  - Each file is a thin wrapper: `createFileRoute('/path')({ component: ThePage })`

- [x] **6. Update `DeckBuilderPage.tsx`**
  - `useParams()` → `Route.useParams()` imported from the route file
  - Links to `/decks/$id` use typed `params={{ id }}` prop

- [x] **7. Update `DecksPage.tsx`**
  - `navigate('/decks/${deck.id}')` → `navigate({ to: '/decks/$id', params: { id: deck.id } })`
  - List item links use typed `to="/decks/$id" params={{ id: deck.id }}`

- [x] **8. Update `CardPage.tsx`**
  - Swap imports to `@tanstack/react-router`
  - `navigate('/cards', { state: { card } })` → `navigate({ to: '/cards', state: { card } })`
  - Deck links use typed `to="/decks/$id" params={{ id: d.id }}`

- [x] **9. Update `InventoryPage.tsx`**
  - Replace `useLocation().state?.setCode` with `Route.useSearch().set`
  - `setSetFilter` initial value reads from `Route.useSearch()` instead of location state

- [x] **10. Update `FinancePage.tsx`**
  - `<Link to="/inventory" state={{ setCode }}>` → `<Link to="/inventory" search={{ set: row.code }}>`
  - Import swapped to `@tanstack/react-router`

- [x] **11. Update `CardRow.tsx`**
  - Swap `Link` import to `@tanstack/react-router`

- [x] **12. Delete `App.tsx`**
  - Nav layout is now in `__root.tsx`; `App.tsx` removed

## New file layout

```
src/
  routes/
    __root.tsx        ← nav layout + Outlet
    index.tsx         ← /
    inventory.tsx     ← /inventory + search schema { set?: string }
    cards.tsx         ← /cards
    finance.tsx       ← /finance
    decks.tsx         ← /decks
    decks.$id.tsx     ← /decks/$id
  routeTree.gen.ts    ← auto-generated, do not edit
  pages/              ← updated imports
  components/         ← CardRow updated import
  main.tsx            ← updated
  App.tsx             ← deleted
```
