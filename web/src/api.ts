export interface Card {
  id: string
  name: string
  imageUri: string | null
  manaCost: string | null
  typeLine: string
  oracleText: string | null
  rarity: string
  setName: string
  prices: Record<string, string | null> | null
}

export interface InventoryEntry {
  id: string
  quantity: number
  card: Card
  inDecks: { id: string; name: string }[]
}

export interface DeckCard {
  id: string
  quantity: number
  card: Card
}

export interface Deck {
  id: string
  name: string
  format: 'standard' | 'commander'
  createdAt: string
  updatedAt: string
}

export interface DeckDetail extends Deck {
  cards: DeckCard[]
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const msg = Array.isArray(body.message) ? body.message.join(', ') : body.message ?? `Error ${res.status}`
    throw new Error(msg)
  }
  if (res.status === 204 || res.headers.get('content-length') === '0') return undefined as T
  return res.json()
}

export const api = {
  cards: {
    search: (q: string) => request<Card[]>(`/cards/search?q=${encodeURIComponent(q)}`),
  },
  inventory: {
    list: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params) : ''
      return request<InventoryEntry[]>(`/inventory${qs}`)
    },
    add: (cardId: string, quantity = 1) =>
      request<InventoryEntry>('/inventory', {
        method: 'POST',
        body: JSON.stringify({ cardId, quantity }),
      }),
    update: (entryId: string, quantity: number) =>
      request<InventoryEntry>(`/inventory/${entryId}`, {
        method: 'PATCH',
        body: JSON.stringify({ quantity }),
      }),
    remove: (entryId: string) =>
      request<void>(`/inventory/${entryId}`, { method: 'DELETE' }),
  },
  decks: {
    list: () => request<Deck[]>('/decks'),
    get: (id: string) => request<DeckDetail>(`/decks/${id}`),
    create: (name: string, format: 'standard' | 'commander') =>
      request<Deck>('/decks', { method: 'POST', body: JSON.stringify({ name, format }) }),
    delete: (id: string) =>
      request<void>(`/decks/${id}`, { method: 'DELETE' }),
    addCard: (deckId: string, cardId: string) =>
      request<DeckCard>(`/decks/${deckId}/cards`, {
        method: 'POST',
        body: JSON.stringify({ cardId, quantity: 1 }),
      }),
    removeCard: (deckId: string, cardId: string) =>
      request<void>(`/decks/${deckId}/cards/${cardId}`, { method: 'DELETE' }),
    validate: (deckId: string) =>
      request<{ valid: boolean; errors: { message: string }[] }>(`/decks/${deckId}/validate`),
  },
}
