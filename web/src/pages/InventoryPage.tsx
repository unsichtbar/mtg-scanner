import { useState, useEffect, useRef, createContext, useContext } from 'react'
import { api, Card, InventoryEntry } from '../api'
import CardRow from '../components/CardRow'
import { Route } from '../routes/inventory'

// --- Context ---

interface InventoryCtx {
  query: string
  setQuery: (q: string) => void
  searchResults: Card[]
  searching: boolean
  pendingCardId: string | null
  addedIds: Set<string>
  inventory: InventoryEntry[]
  loadingInventory: boolean
  removingId: string | null
  adjustingId: string | null
  setFilter: string
  setSetFilter: (v: string) => void
  sets: [string, string][]
  visibleInventory: InventoryEntry[]
  addToInventory: (card: Card) => Promise<void>
  adjustQuantity: (entry: InventoryEntry, delta: number) => Promise<void>
  removeFromInventory: (entryId: string) => Promise<void>
  refreshInventory: () => Promise<void>
}

const InventoryContext = createContext<InventoryCtx | null>(null)

function useInventory() {
  const ctx = useContext(InventoryContext)
  if (!ctx) throw new Error('Must be used inside <Inventory>')
  return ctx
}

// --- Compound component ---

function Inventory({ children }: { children: React.ReactNode }) {
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Card[]>([])
  const [searching, setSearching] = useState(false)
  const [pendingCardId, setPendingCardId] = useState<string | null>(null)
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())
  const [inventory, setInventory] = useState<InventoryEntry[]>([])
  const [loadingInventory, setLoadingInventory] = useState(true)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [adjustingId, setAdjustingId] = useState<string | null>(null)
  const { set } = Route.useSearch()
  const [setFilter, setSetFilter] = useState(() => set ?? '')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    api.inventory.list().then(setInventory).finally(() => setLoadingInventory(false))
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) { setSearchResults([]); return }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try { setSearchResults(await api.cards.search(query)) }
      finally { setSearching(false) }
    }, 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  async function addToInventory(card: Card) {
    setPendingCardId(card.id)
    try {
      const entry = await api.inventory.add(card.id)
      setAddedIds((prev) => new Set(prev).add(card.id))
      setInventory((prev) => {
        const existing = prev.find((e) => e.card.id === card.id)
        if (existing) return prev.map((e) => e.card.id === card.id ? { ...e, quantity: entry.quantity } : e)
        return [entry, ...prev]
      })
    } finally {
      setPendingCardId(null)
    }
  }

  async function adjustQuantity(entry: InventoryEntry, delta: number) {
    const newQty = entry.quantity + delta
    if (newQty <= 0) return removeFromInventory(entry.id)
    setAdjustingId(entry.id)
    try {
      const updated = await api.inventory.update(entry.id, newQty)
      setInventory((prev) => prev.map((e) => e.id === entry.id ? { ...e, quantity: updated.quantity } : e))
    } finally {
      setAdjustingId(null)
    }
  }

  async function removeFromInventory(entryId: string) {
    setRemovingId(entryId)
    try {
      await api.inventory.remove(entryId)
      setInventory((prev) => prev.filter((e) => e.id !== entryId))
    } finally {
      setRemovingId(null)
    }
  }

  async function refreshInventory() {
    setInventory(await api.inventory.list())
  }

  const sets = Array.from(
    new Map(inventory.map((e) => [e.card.setCode, e.card.setName])).entries()
  ).sort((a, b) => a[1].localeCompare(b[1]))

  const visibleInventory = setFilter
    ? inventory.filter((e) => e.card.setCode === setFilter)
    : inventory

  return (
    <InventoryContext.Provider value={{
      query, setQuery, searchResults, searching, pendingCardId, addedIds,
      inventory, loadingInventory, removingId, adjustingId,
      setFilter, setSetFilter, sets, visibleInventory,
      addToInventory, adjustQuantity, removeFromInventory, refreshInventory,
    }}>
      {children}
    </InventoryContext.Provider>
  )
}

Inventory.Search = function Search() {
  const { query, setQuery, searching, searchResults, inventory, pendingCardId, addedIds, addToInventory } = useInventory()
  const inventoryCardIds = new Set(inventory.map((e) => e.card.id))
  return (
    <section className="mb-8">
      <h2 className="text-xs font-medium uppercase tracking-wide text-fg-faint mb-2">Add cards by name</h2>
      <div className="relative">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for a card…"
          className="w-full px-3 py-2 border border-outline-strong rounded-lg text-sm bg-surface-muted text-fg placeholder:text-fg-faint focus:outline-none focus:ring-2 focus:ring-focus"
        />
        {searching && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-fg-faint">Searching…</span>
        )}
      </div>
      {searchResults.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1.5">
          {searchResults.map((card) => {
            const inInventory = inventoryCardIds.has(card.id)
            const justAdded = addedIds.has(card.id)
            return (
              <CardRow key={card.id} card={card} subtitle={`${card.setName} · ${card.typeLine}`}>
                {card.prices?.usd && (
                  <span className="text-xs text-fg-muted shrink-0">${card.prices.usd}</span>
                )}
                <button
                  onClick={() => addToInventory(card)}
                  disabled={pendingCardId === card.id}
                  className={`text-sm px-2.5 py-1 rounded-lg font-medium transition-colors disabled:opacity-40 cursor-pointer shrink-0 ${
                    justAdded || inInventory
                      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                      : 'bg-surface-muted text-fg-soft hover:bg-surface-strong'
                  }`}
                >
                  {pendingCardId === card.id ? '…' : inInventory ? '+1' : 'Add'}
                </button>
              </CardRow>
            )
          })}
        </ul>
      )}
    </section>
  )
}

Inventory.Collection = function Collection() {
  const {
    inventory, loadingInventory, visibleInventory, setFilter, setSetFilter, sets,
    removingId, adjustingId, adjustQuantity, removeFromInventory, refreshInventory,
  } = useInventory()
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; errors: string[] } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImporting(true)
    setImportResult(null)
    try {
      const result = await api.inventory.importCsv(file)
      setImportResult(result)
      if (result.imported > 0) await refreshInventory()
    } finally {
      setImporting(false)
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-fg-faint">
          My collection{!loadingInventory && ` · ${visibleInventory.length}${setFilter ? ` of ${inventory.length}` : ''} card${inventory.length !== 1 ? 's' : ''}`}
        </h2>
        <div className="flex items-center gap-2">
          {sets.length > 0 && (
            <select
              value={setFilter}
              onChange={(e) => setSetFilter(e.target.value)}
              className="text-xs border border-outline rounded-lg px-2 py-1 text-fg-soft bg-surface-muted focus:outline-none focus:ring-1 focus:ring-focus cursor-pointer"
            >
              <option value="">All sets</option>
              {sets.map(([code, name]) => (
                <option key={code} value={code}>{name} ({code.toUpperCase()})</option>
              ))}
            </select>
          )}
          <button
            onClick={() => api.inventory.exportCsv()}
            disabled={inventory.length === 0}
            className="text-xs border border-outline rounded-lg px-2 py-1 text-fg-soft bg-surface-muted hover:bg-surface-strong disabled:opacity-40 cursor-pointer"
          >Export CSV</button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="text-xs border border-outline rounded-lg px-2 py-1 text-fg-soft bg-surface-muted hover:bg-surface-strong disabled:opacity-40 cursor-pointer"
          >{importing ? 'Importing…' : 'Import CSV'}</button>
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleImport} />
        </div>
      </div>
      {importResult && (
        <div className={`text-xs rounded-lg px-3 py-2 mb-3 ${importResult.errors.length > 0 ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`}>
          Imported {importResult.imported} card{importResult.imported !== 1 ? 's' : ''}.
          {importResult.errors.length > 0 && (
            <ul className="mt-1 list-disc list-inside">
              {importResult.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
        </div>
      )}
      {loadingInventory ? (
        <p className="text-fg-faint text-sm text-center py-8">Loading…</p>
      ) : inventory.length === 0 ? (
        <p className="text-fg-faint text-sm text-center py-8">No cards yet. Search above to add some.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {visibleInventory.map((entry) => (
            <CardRow
              key={entry.id}
              card={entry.card}
              subtitle={`${entry.card.setName} · ${entry.card.typeLine}`}
              nameLink="/cards"
              nameLinkState={{ card: entry.card }}
            >
              {entry.card.prices?.usd && (
                <span className="text-xs text-fg-muted shrink-0">${entry.card.prices.usd}</span>
              )}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => adjustQuantity(entry, -1)}
                  disabled={adjustingId === entry.id || removingId === entry.id}
                  className="w-6 h-6 flex items-center justify-center rounded text-fg-faint hover:bg-surface-muted hover:text-fg-mid disabled:opacity-40 cursor-pointer text-base leading-none"
                >−</button>
                <input
                  type="number"
                  min={1}
                  defaultValue={entry.quantity}
                  key={entry.quantity}
                  disabled={adjustingId === entry.id || removingId === entry.id}
                  onBlur={(e) => {
                    const val = parseInt(e.target.value, 10)
                    if (!isNaN(val) && val !== entry.quantity) adjustQuantity(entry, val - entry.quantity)
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                  className="w-10 text-center text-sm text-fg-soft bg-surface-muted border border-outline rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-focus disabled:opacity-40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                  onClick={() => adjustQuantity(entry, +1)}
                  disabled={adjustingId === entry.id || removingId === entry.id}
                  className="w-6 h-6 flex items-center justify-center rounded text-fg-faint hover:bg-surface-muted hover:text-fg-mid disabled:opacity-40 cursor-pointer text-base leading-none"
                >+</button>
              </div>
              <button
                onClick={() => removeFromInventory(entry.id)}
                disabled={removingId === entry.id || adjustingId === entry.id}
                className="text-fg-ghost hover:text-red-400 transition-colors text-lg leading-none disabled:opacity-40 cursor-pointer"
              >
                ×
              </button>
            </CardRow>
          ))}
        </ul>
      )}
    </section>
  )
}

// --- Page ---

export default function InventoryPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-fg mb-6">Inventory</h1>
      <Inventory>
        <Inventory.Search />
        <Inventory.Collection />
      </Inventory>
    </div>
  )
}
