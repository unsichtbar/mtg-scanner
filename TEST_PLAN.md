# Plan: Backend Unit Tests

## Context
No `.spec.ts` files exist in the backend. The goal is comprehensive unit tests for all five services. Tests use Jest + ts-jest, mocking EntityManager and external dependencies so no real DB or HTTP is needed.

## Files to create
- `backend/src/auth/auth.service.spec.ts`
- `backend/src/inventory/inventory.service.spec.ts`
- `backend/src/decks/decks.service.spec.ts`
- `backend/src/scryfall/scryfall.service.spec.ts`
- `backend/src/scan/scan.service.spec.ts`

## Mock setup pattern (reuse in each file)

```ts
const mockEm = {
  findOne: jest.fn(),
  findOneOrFail: jest.fn(),
  find: jest.fn(),
  persist: jest.fn(),
  remove: jest.fn(),
  flush: jest.fn(),
  nativeDelete: jest.fn(),
};
// In beforeEach: jest.clearAllMocks()
// Provider: { provide: EntityManager, useValue: mockEm }
```

Build `TestingModule` inside `beforeEach` (not `beforeAll`) to avoid state leakage.

## Key implementation notes from reading the code

### AuthService (`auth.service.ts`)
- `register`: `findOne` → throw `ConflictException` if found; else `bcrypt.hash`, `persist`, `flush`, `jwt.sign`
- `login`: `findOne` → throw `UnauthorizedException` if null; `bcrypt.compare` → throw if false; `jwt.sign`
- Mock bcrypt with `jest.mock('bcrypt', () => ({ hash: jest.fn(), compare: jest.fn() }))`

### InventoryService (`inventory.service.ts`)
- `add`: calls `scryfall.findById` first, then `findOneOrFail(User, userId)`, then `findOne(InventoryEntry, { user, card })`
- `list`: three `em.find` calls in sequence: `InventoryEntry`, `Deck`, `DeckCard`
- `update`/`remove`: `findOne(InventoryEntry, { id, user: userId })` → null throws `NotFoundException`

### DecksService (`decks.service.ts`)
- `setCardQuantity` throws raw `Error` (not `BadRequestException`) for copy violations
- `ensureOwner`: single `findOne(Deck, { id, user })` → null = `NotFoundException` (not `ForbiddenException`, even for wrong user)
- `validate` calls `this.get()` which calls `em.findOne(Deck, { id, user }, { populate })` — mock must return object with `cards: { getItems: () => [...] }`
- `delete`: `nativeDelete(DeckCard, { deck: deck.id })`, then `remove(deck)`, then `flush()`
- `addCard`: `ensureOwner` (findOne #1), `scryfall.findById`, `findOne(DeckCard)` (findOne #2) — sequence matters

### ScryfallService (`scryfall.service.ts`)
- `findByName`: `findOne(Card, { name: $ilike })` (cache check), then HTTP, then `upsertCard` which calls `findOne(Card, data.id)` — two `findOne` calls on cache miss
- `search`: on HTTP error returns `[]` (no throw). Calls `upsertCard` per result → one `findOne` per card
- HTTP mock: `mockHttp.get` must return an Observable. Use `of({data})` from `rxjs` for success, `throwError(...)` for errors

### ScanService (`scan.service.ts`)
- Mock tesseract: `jest.mock('tesseract.js', () => ({ createWorker: jest.fn() }))`
- Worker pattern: `createWorker` returns a mock with `recognize` and `terminate`
- `terminate` is always called (finally block) — test this even when `recognize` throws
- `extractCardName`: filters lines with `length > 2`, returns first remaining line

## Test cases per file

### auth.service.spec.ts
- `register` — success: hashes password, persists, returns token
- `register` — throws `ConflictException` when email taken
- `register` — does not call `bcrypt.hash` when email conflict detected early
- `login` — success: returns token
- `login` — throws `UnauthorizedException` when user not found
- `login` — throws `UnauthorizedException` when password wrong
- `login` — does not call `bcrypt.compare` when user not found

### inventory.service.spec.ts
- `list` — returns entries with `inDecks` populated from deckCards
- `list` — returns empty `inDecks` when no deckCards exist for a card
- `list` — applies `$ilike` filter on `card.name` when name given
- `list` — applies `$overlap` filter on `card.colors` when colors given
- `add` — creates new entry when none exists
- `add` — increments quantity on existing entry (no new persist)
- `add` — calls `scryfall.findById` with correct cardId
- `update` — updates quantity and returns entry
- `update` — throws `NotFoundException` when entry not found
- `remove` — calls `em.remove` and `em.flush`
- `remove` — throws `NotFoundException` when entry not found

### decks.service.spec.ts
- `list` — calls `em.find` with userId and orderBy
- `create` — persists and returns new deck
- `get` — returns deck with populated cards
- `get` — throws `NotFoundException` when not found/not owned
- `addCard` — creates new DeckCard when card not in deck
- `addCard` — increments existing DeckCard quantity
- `addCard` — throws `NotFoundException` when deck not owned
- `setCardQuantity` — updates quantity and returns deckCard
- `setCardQuantity` — removes card and returns null when quantity ≤ 0
- `setCardQuantity` — throws `Error` when standard deck exceeds 4 copies of non-basic
- `setCardQuantity` — allows >4 copies of basic land in standard
- `setCardQuantity` — throws `Error` when commander deck has >1 copy of non-basic
- `setCardQuantity` — allows >1 copy of basic land in commander
- `setCardQuantity` — throws `NotFoundException` when card not in deck
- `removeCard` — removes and flushes
- `removeCard` — throws `NotFoundException` when card not in deck
- `validate` (standard) — valid for legal 60-card deck
- `validate` (standard) — error when fewer than 60 cards
- `validate` (standard) — error when non-basic card has >4 copies
- `validate` (standard) — error when card not legal in standard
- `validate` (standard) — no error for basic land with >4 copies
- `validate` (commander) — valid for legal 100-card deck
- `validate` (commander) — error when not exactly 100 cards
- `validate` (commander) — error when non-basic card has >1 copy
- `validate` (commander) — error when card not legal in commander
- `delete` — calls nativeDelete, remove, flush

### scryfall.service.spec.ts
- `findByName` — returns cached card without HTTP call
- `findByName` — fetches from Scryfall when not cached, upserts, returns card
- `findByName` — throws `NotFoundException` on HTTP error
- `findById` — returns cached card without HTTP call
- `findById` — fetches from Scryfall when not cached
- `findById` — throws `NotFoundException` on HTTP error
- `search` — returns empty array on HTTP error (no throw)
- `search` — returns at most 20 cards
- `search` — upserts each returned card
- `upsertCard` (via findByName) — creates new Card when not in DB
- `upsertCard` (via findByName) — updates existing Card fields
- `upsertCard` — uses `card_faces[0]` image when `image_uris` absent
- `upsertCard` — sets `isBasicLand=true` when type_line contains "Basic Land"

### scan.service.spec.ts
- `scanImage` — returns `{ cardName, card, inventoryEntry }` on success
- `scanImage` — calls `scryfall.findByName` with first line of OCR text (>2 chars)
- `scanImage` — calls `inventory.add` with userId and card.id
- `scanImage` — always calls `worker.terminate()` even when `recognize` throws
- `scanImage` — throws `BadRequestException` when OCR text is empty
- `scanImage` — throws `BadRequestException` when all OCR lines are ≤2 chars
- `scanImage` — propagates errors from `scryfall.findByName`

## Verification
- Run `pnpm --filter @mtg-scanner/backend test` — all tests pass
- Run `pnpm --filter @mtg-scanner/backend test:cov` — check coverage report
