# MTG Scanner — Implementation Plan

## Decisions
- **Card scanning**: OCR on card name → lookup via Scryfall API
- **Auth**: User accounts (JWT-based)
- **Database**: PostgreSQL + MikroORM

---

## Shared (`@mtg-scanner/shared`)
- [ ] TypeScript types/interfaces: `Card`, `Deck`, `DeckCard`, `InventoryEntry`, `GameFormat`, `User`
- [ ] Card search filter types: name, color, mana cost, card text, type, rarity
- [ ] Deck validation logic (rules engine)
  - [ ] Commander: exactly 100 cards, no duplicates except basic lands, one legendary commander
  - [ ] Standard: minimum 60 cards, max 4 copies of any non-basic land card
- [ ] Typed API client wrapper (shared by web + mobile)

---

## Backend (`@mtg-scanner/backend`)

### Auth
- [ ] `POST /auth/register` — create account (email + password)
- [ ] `POST /auth/login` — return JWT
- [ ] JWT guard applied to all protected routes

### Card scanning
- [ ] `POST /scan` — accept image, run OCR to extract card name, query Scryfall by name, return matched card data
- [ ] OCR library: [Tesseract.js](https://github.com/naptha/tesseract.js) (runs in Node)

### Inventory
- [ ] `POST /inventory` — add card(s) by Scryfall card ID + quantity
- [ ] `GET /inventory` — list with filters: name, color, mana cost, oracle text, type, rarity
- [ ] `PATCH /inventory/:id` — update quantity
- [ ] `DELETE /inventory/:id` — remove entry

### Decks
- [ ] `POST /decks` — create deck (name, format: `standard` | `commander`)
- [ ] `GET /decks` — list user's decks
- [ ] `GET /decks/:id` — deck with full card list
- [ ] `POST /decks/:id/cards` — add card to deck
- [ ] `DELETE /decks/:id/cards/:cardId` — remove card from deck
- [ ] `GET /decks/:id/validate` — validate against format rules, return errors

### Infrastructure
- [ ] MikroORM setup with `@mikro-orm/nestjs`, `@mikro-orm/postgresql`, `@mikro-orm/migrations`
- [ ] Entities: `User`, `Card` (Scryfall cache), `InventoryEntry`, `Deck`, `DeckCard`
- [ ] `mikro-orm.config.ts` with connection + migration settings
- [ ] Docker Compose for local Postgres
- [ ] `.env` for DB URL, JWT secret, Scryfall base URL

---

## Web (`@mtg-scanner/web`)
- [ ] React Router setup
- [ ] Auth pages: login, register
- [ ] Protected route wrapper
- [ ] **Inventory page** — browse/search/filter owned cards, add/remove manually
- [ ] **Scanner page** — webcam capture via browser API, POST to `/scan`, confirm and add to inventory
- [ ] **Decks page** — list decks, create new deck (choose format)
- [ ] **Deck builder page** — search inventory, add/remove cards, live validation, mana curve + color distribution stats

---

## Mobile (`@mtg-scanner/mobile`)
- [ ] Expo Camera for card scanning
- [ ] Auth screens: login, register
- [ ] **Scan screen** — primary flow: point camera → OCR → confirm → add to inventory
- [ ] **Inventory screen** — browse owned cards with search/filter
- [ ] **Decks screen** — list and create decks
- [ ] **Deck detail screen** — add/remove cards, validation feedback
