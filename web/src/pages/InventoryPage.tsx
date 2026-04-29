import { useState, useEffect, useRef, useSyncExternalStore, createContext, useContext } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Link } from '@tanstack/react-router'
import { api, Card, InventoryEntry } from '../api'
import { Inventory } from '../models/Inventory'
import CardRow from '../components/CardRow'
import { Route } from '../routes/inventory'

// --- Inventory context (data + mutations) ---

interface InventoryCtx {
  query: string
  setQuery: (q: string) => void
  searchResults: Card[]
  searching: boolean
  inventory: Inventory
}

const InventoryContext = createContext<InventoryCtx | null>(null)

function useInventory() {
  const ctx = useContext(InventoryContext)
  if (!ctx) throw new Error('Must be used inside <Inventory>')
  return ctx
}

// --- Printings context (hover + swap) ---

interface PrintingsCtx {
  hoveredEntry: InventoryEntry | null
  hoveredPrintings: Card[]
  loadingPrintings: boolean
  switchingCardId: string | null
  setHoveredEntry: (entry: InventoryEntry) => void
  handleSwap: (printing: Card) => Promise<void>
}

const PrintingsContext = createContext<PrintingsCtx | null>(null)

function usePrintings() {
  const ctx = useContext(PrintingsContext)
  if (!ctx) throw new Error('Must be used inside <PrintingsProvider>')
  return ctx
}

function PrintingsProvider({ children }: { children: React.ReactNode }) {
  const { inventory } = useInventory()
  const { entries } = useInventorySnapshot()

  const [hoveredEntry, setHoveredEntryState] = useState<InventoryEntry | null>(null)
  const [hoveredPrintings, setHoveredPrintings] = useState<Card[]>([])
  const [loadingPrintings, setLoadingPrintings] = useState(false)
  const [switchingCardId, setSwitchingCardId] = useState<string | null>(null)
  const printingsCacheRef = useRef<Map<string, Card[]>>(new Map())
  const currentHoveredRef = useRef<string | null>(null)

  function setHoveredEntry(entry: InventoryEntry) {
    if (currentHoveredRef.current === entry.id) return
    currentHoveredRef.current = entry.id
    setHoveredEntryState(entry)
    if (printingsCacheRef.current.has(entry.card.name)) {
      const all = printingsCacheRef.current.get(entry.card.name)!
      setHoveredPrintings(all.filter((p) => p.id !== entry.card.id))
      setLoadingPrintings(false)
    } else {
      setHoveredPrintings([])
      setLoadingPrintings(true)
      const { id: cardId, name: cardName } = entry.card
      const entryId = entry.id
      api.cards.printings(cardName).then((all) => {
        printingsCacheRef.current.set(cardName, all)
        if (currentHoveredRef.current === entryId) {
          setHoveredPrintings(all.filter((p) => p.id !== cardId))
          setLoadingPrintings(false)
        }
      })
    }
  }

  // Keep hoveredEntry in sync with inventory so quantity is never stale across swaps
  useEffect(() => {
    if (!hoveredEntry) return
    const fresh = entries.find((e) => e.id === hoveredEntry.id)
    if (fresh !== hoveredEntry) {
      if (fresh) {
        setHoveredEntryState(fresh)
      } else {
        setHoveredEntryState(null)
        currentHoveredRef.current = null
      }
    }
  }, [entries]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSwap(printing: Card) {
    if (!hoveredEntry) return
    setSwitchingCardId(printing.id)
    try {
      await inventory.switchVersion(hoveredEntry, printing.id)
    } finally {
      setSwitchingCardId(null)
    }
  }

  return (
    <PrintingsContext.Provider value={{
      hoveredEntry, hoveredPrintings, loadingPrintings, switchingCardId,
      setHoveredEntry, handleSwap,
    }}>
      {children}
    </PrintingsContext.Provider>
  )
}

// Convenience hook — subscribes to inventory state changes
function useInventorySnapshot() {
  const { inventory } = useInventory()
  return useSyncExternalStore(inventory.subscribe, inventory.getSnapshot)
}

// --- Inventory provider ---

function InventoryProvider({ children }: { children: React.ReactNode }) {
  const { set } = Route.useSearch()
  const [inventory] = useState(() => new Inventory(set ?? ''))

  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Card[]>([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { inventory.load() }, [inventory])

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

  return (
    <InventoryContext.Provider value={{ query, setQuery, searchResults, searching, inventory }}>
      {children}
    </InventoryContext.Provider>
  )
}

// --- Sub-components ---

function Search() {
  const { query, setQuery, searching, searchResults, inventory } = useInventory()
  const { entries, pendingCardId, addedIds } = useInventorySnapshot()
  const inventoryCardIds = new Set(entries.map((e) => e.card.id))
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
                  onClick={() => inventory.add(card)}
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

function Collection() {
  const { inventory } = useInventory()
  const { setHoveredEntry } = usePrintings()
  const { entries, loading, visibleEntries, sets, filter, removingId, adjustingId } = useInventorySnapshot()
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; errors: string[] } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const versionedFileInputRef = useRef<HTMLInputElement>(null)

  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: visibleEntries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 62,
    overscan: 5,
  })

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>, versioned: boolean) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImporting(true)
    setImportResult(null)
    try {
      const result = await (versioned ? inventory.importVersionedCsv(file) : inventory.importCsv(file))
      setImportResult(result)
    } finally {
      setImporting(false)
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-fg-faint">
          My collection{!loading && ` · ${visibleEntries.length}${filter ? ` of ${entries.length}` : ''} card${entries.length !== 1 ? 's' : ''}`}
        </h2>
        <div className="flex items-center gap-2">
          {sets.length > 0 && (
            <select
              value={filter}
              onChange={(e) => inventory.setFilter(e.target.value)}
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
            disabled={entries.length === 0}
            className="text-xs border border-outline rounded-lg px-2 py-1 text-fg-soft bg-surface-muted hover:bg-surface-strong disabled:opacity-40 cursor-pointer"
          >Export (by name)</button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="text-xs border border-outline rounded-lg px-2 py-1 text-fg-soft bg-surface-muted hover:bg-surface-strong disabled:opacity-40 cursor-pointer"
          >{importing ? 'Importing…' : 'Import (by name)'}</button>
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => handleImport(e, false)} />
          <button
            onClick={() => api.inventory.exportVersionedCsv()}
            disabled={entries.length === 0}
            className="text-xs border border-outline rounded-lg px-2 py-1 text-fg-soft bg-surface-muted hover:bg-surface-strong disabled:opacity-40 cursor-pointer"
          >Export (versioned)</button>
          <button
            onClick={() => versionedFileInputRef.current?.click()}
            disabled={importing}
            className="text-xs border border-outline rounded-lg px-2 py-1 text-fg-soft bg-surface-muted hover:bg-surface-strong disabled:opacity-40 cursor-pointer"
          >{importing ? 'Importing…' : 'Import (versioned)'}</button>
          <input ref={versionedFileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => handleImport(e, true)} />
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
      {loading ? (
        <p className="text-fg-faint text-sm text-center py-8">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-fg-faint text-sm text-center py-8">No cards yet. Search above to add some.</p>
      ) : (
        <div ref={parentRef} className="overflow-y-auto max-h-[60vh]">
          <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const entry = visibleEntries[virtualItem.index]
              return (
                <div
                  key={virtualItem.key}
                  data-index={virtualItem.index}
                  ref={virtualizer.measureElement}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${virtualItem.start}px)`, paddingBottom: '6px' }}
                  onMouseEnter={() => setHoveredEntry(entry)}
                >
                  <div className="flex items-center gap-3 border border-outline rounded-lg px-3 py-2 bg-surface-muted">
                    {entry.card.imageUri && (
                      <img src={entry.card.imageUri} alt={entry.card.name} className="w-8 rounded shrink-0" />
                    )}
                    <Link to="/cards" state={{ card: entry.card }} className="flex-1 min-w-0 hover:underline decoration-fg-ghost">
                      <p className="text-sm font-medium text-fg truncate">{entry.card.name}</p>
                      <p className="text-xs text-fg-faint">{entry.card.setName} · {entry.card.typeLine}</p>
                      {((entry.inContainers?.length ?? 0) > 0 || (entry.inDecks?.length ?? 0) > 0) && (
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {(entry.inContainers ?? []).map((c) => (
                            <span key={c.id} className="text-xs bg-indigo-900/40 text-indigo-300 rounded px-1.5 py-0.5 leading-none">
                              {c.name}{c.quantity > 1 ? ` ×${c.quantity}` : ''}
                            </span>
                          ))}
                          {(entry.inDecks ?? []).map((d) => (
                            <span key={d.id} className="text-xs bg-surface-strong text-fg-faint rounded px-1.5 py-0.5 leading-none">
                              {d.name}{d.quantity > 1 ? ` ×${d.quantity}` : ''}
                            </span>
                          ))}
                        </div>
                      )}
                    </Link>
                    {entry.card.prices?.usd && (
                      <span className="text-xs text-fg-muted shrink-0">${entry.card.prices.usd}</span>
                    )}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => inventory.adjustQuantity(entry, -1)}
                        disabled={adjustingId === entry.id || removingId === entry.id}
                        className="w-6 h-6 flex items-center justify-center rounded text-fg-faint hover:bg-surface-strong hover:text-fg-mid disabled:opacity-40 cursor-pointer text-base leading-none"
                      >−</button>
                      <input
                        type="number"
                        min={1}
                        defaultValue={entry.quantity}
                        key={entry.quantity}
                        disabled={adjustingId === entry.id || removingId === entry.id}
                        onBlur={(e) => {
                          const val = parseInt(e.target.value, 10)
                          if (!isNaN(val) && val !== entry.quantity) inventory.adjustQuantity(entry, val - entry.quantity)
                        }}
                        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                        className="w-10 text-center text-sm text-fg-soft bg-surface-muted border border-outline rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-focus disabled:opacity-40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <button
                        onClick={() => inventory.adjustQuantity(entry, +1)}
                        disabled={adjustingId === entry.id || removingId === entry.id}
                        className="w-6 h-6 flex items-center justify-center rounded text-fg-faint hover:bg-surface-strong hover:text-fg-mid disabled:opacity-40 cursor-pointer text-base leading-none"
                      >+</button>
                    </div>
                    <button
                      onClick={() => inventory.remove(entry.id)}
                      disabled={removingId === entry.id || adjustingId === entry.id}
                      className="text-fg-ghost hover:text-red-400 transition-colors text-lg leading-none disabled:opacity-40 cursor-pointer"
                    >×</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}

function Printings() {
  const { hoveredEntry, hoveredPrintings, loadingPrintings, switchingCardId, handleSwap } = usePrintings()

  return (
    <aside className="sticky top-16">
      <h2 className="text-xs font-medium uppercase tracking-wide text-fg-faint mb-2">Alternate printings</h2>
      {!hoveredEntry ? (
        <p className="text-xs text-fg-ghost text-center py-8">Hover a card to see other printings</p>
      ) : (
        <div>
          <p className="text-sm font-medium text-fg truncate mb-2">{hoveredEntry.card.name}</p>
          {loadingPrintings ? (
            <p className="text-xs text-fg-faint py-4 text-center">Finding printings…</p>
          ) : hoveredPrintings.length === 0 ? (
            <p className="text-xs text-fg-faint py-4 text-center">No other printings found.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {hoveredPrintings.map((printing) => (
                <li key={printing.id} className="flex items-center gap-2 border border-outline rounded-lg px-2 py-1.5 bg-surface-muted">
                  {printing.imageUri && (
                    <img src={printing.imageUri} alt={printing.name} className="w-8 rounded shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-fg truncate">{printing.setName}</p>
                    <p className="text-xs text-fg-faint uppercase">{printing.setCode}</p>
                  </div>
                  <button
                    onClick={() => handleSwap(printing)}
                    disabled={switchingCardId !== null}
                    className="text-xs px-2 py-1 rounded border border-outline bg-surface-muted text-fg-soft hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-colors disabled:opacity-40 cursor-pointer shrink-0"
                  >
                    {switchingCardId === printing.id ? '…' : 'Swap 1'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </aside>
  )
}

// --- Page ---

export default function InventoryPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-fg mb-6">Inventory</h1>
      <InventoryProvider>
        <PrintingsProvider>
          <div className="flex gap-6 items-start">
            <div className="w-64 shrink-0">
              <Printings />
            </div>
            <div className="flex-1 min-w-0">
              <Search />
              <Collection />
            </div>
          </div>
        </PrintingsProvider>
      </InventoryProvider>
    </div>
  )
}
