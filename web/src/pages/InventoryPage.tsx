import { useState, useEffect, useRef, createContext, useContext, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Link } from '@tanstack/react-router'
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
  switchVersion: (entry: InventoryEntry, newCardId: string) => Promise<void>
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

  async function switchVersion(entry: InventoryEntry, newCardId: string) {
    await api.inventory.add(newCardId, 1)
    if (entry.quantity <= 1) {
      await api.inventory.remove(entry.id)
    } else {
      await api.inventory.update(entry.id, entry.quantity - 1)
    }
    await refreshInventory()
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
      addToInventory, adjustQuantity, removeFromInventory, refreshInventory, switchVersion,
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
    removingId, adjustingId, adjustQuantity, removeFromInventory, refreshInventory, switchVersion,
  } = useInventory()
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; errors: string[] } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const versionedFileInputRef = useRef<HTMLInputElement>(null)

  // Virtualizer
  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: visibleInventory.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 62,
    overscan: 5,
  })

  // Hover / printings popover
  const [hoveredEntryId, setHoveredEntryId] = useState<string | null>(null)
  const [hoveredEntry, setHoveredEntry] = useState<InventoryEntry | null>(null)
  const [hoveredRect, setHoveredRect] = useState<DOMRect | null>(null)
  const [printings, setPrintings] = useState<Card[]>([])
  const [loadingPrintings, setLoadingPrintings] = useState(false)
  const [switchingCardId, setSwitchingCardId] = useState<string | null>(null)
  const printingsCacheRef = useRef<Map<string, Card[]>>(new Map())
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentHoveredRef = useRef<string | null>(null)

  // Close popover on scroll so it doesn't drift from its row
  useEffect(() => {
    const el = parentRef.current
    if (!el) return
    const close = () => setHoveredEntryId(null)
    el.addEventListener('scroll', close, { passive: true })
    return () => el.removeEventListener('scroll', close)
  }, [])

  function onRowEnter(entry: InventoryEntry, el: HTMLElement) {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    currentHoveredRef.current = entry.id
    setHoveredEntryId(entry.id)
    setHoveredEntry(entry)
    setHoveredRect(el.getBoundingClientRect())
    if (printingsCacheRef.current.has(entry.card.name)) {
      const all = printingsCacheRef.current.get(entry.card.name)!
      setPrintings(all.filter((p) => p.id !== entry.card.id))
      setLoadingPrintings(false)
    } else {
      setPrintings([])
      setLoadingPrintings(true)
      const { id: cardId, name: cardName } = entry.card
      const entryId = entry.id
      api.cards.printings(cardName).then((all) => {
        printingsCacheRef.current.set(cardName, all)
        if (currentHoveredRef.current === entryId) {
          setPrintings(all.filter((p) => p.id !== cardId))
          setLoadingPrintings(false)
        }
      })
    }
  }

  function onRowLeave() {
    hideTimerRef.current = setTimeout(() => setHoveredEntryId(null), 150)
  }

  function onPopoverEnter() {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
  }

  const closePopover = useCallback(() => {
    setHoveredEntryId(null)
    setHoveredEntry(null)
    setHoveredRect(null)
  }, [])

  async function handleSwap(printing: Card) {
    if (!hoveredEntry) return
    setSwitchingCardId(printing.id)
    try {
      await switchVersion(hoveredEntry, printing.id)
      closePopover()
    } finally {
      setSwitchingCardId(null)
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>, versioned: boolean) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImporting(true)
    setImportResult(null)
    try {
      const result = await (versioned ? api.inventory.importVersionedCsv(file) : api.inventory.importCsv(file))
      setImportResult(result)
      if (result.imported > 0) await refreshInventory()
    } finally {
      setImporting(false)
    }
  }

  // Position popover above the row when too close to the bottom of the viewport
  const popoverStyle = hoveredRect ? (() => {
    const POPOVER_H = 288 // max-h-72
    const top = hoveredRect.bottom + 4 + POPOVER_H > window.innerHeight
      ? hoveredRect.top - POPOVER_H - 4
      : hoveredRect.bottom + 4
    return { position: 'fixed' as const, top, left: hoveredRect.left, width: hoveredRect.width, zIndex: 50 }
  })() : null

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
          >Export (by name)</button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="text-xs border border-outline rounded-lg px-2 py-1 text-fg-soft bg-surface-muted hover:bg-surface-strong disabled:opacity-40 cursor-pointer"
          >{importing ? 'Importing…' : 'Import (by name)'}</button>
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => handleImport(e, false)} />
          <button
            onClick={() => api.inventory.exportVersionedCsv()}
            disabled={inventory.length === 0}
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
      {loadingInventory ? (
        <p className="text-fg-faint text-sm text-center py-8">Loading…</p>
      ) : inventory.length === 0 ? (
        <p className="text-fg-faint text-sm text-center py-8">No cards yet. Search above to add some.</p>
      ) : (
        <div ref={parentRef} className="overflow-y-auto max-h-[60vh]">
          <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const entry = visibleInventory[virtualItem.index]
              return (
                <div
                  key={virtualItem.key}
                  data-index={virtualItem.index}
                  ref={virtualizer.measureElement}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${virtualItem.start}px)`, paddingBottom: '6px' }}
                  onMouseEnter={(e) => onRowEnter(entry, e.currentTarget)}
                  onMouseLeave={onRowLeave}
                >
                  <div className="flex items-center gap-3 border border-outline rounded-lg px-3 py-2 bg-surface-muted">
                    {entry.card.imageUri && (
                      <img src={entry.card.imageUri} alt={entry.card.name} className="w-8 rounded shrink-0" />
                    )}
                    <Link to="/cards" state={{ card: entry.card }} className="flex-1 min-w-0 hover:underline decoration-fg-ghost">
                      <p className="text-sm font-medium text-fg truncate">{entry.card.name}</p>
                      <p className="text-xs text-fg-faint">{entry.card.setName} · {entry.card.typeLine}</p>
                      {((entry.inContainers?.length ?? 0) > 0 || entry.inDecks.length > 0) && (
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {(entry.inContainers ?? []).map((c) => (
                            <span key={c.id} className="text-xs bg-indigo-900/40 text-indigo-300 rounded px-1.5 py-0.5 leading-none">
                              {c.name}{c.quantity > 1 ? ` ×${c.quantity}` : ''}
                            </span>
                          ))}
                          {entry.inDecks.map((d) => (
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
                        onClick={() => adjustQuantity(entry, -1)}
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
                          if (!isNaN(val) && val !== entry.quantity) adjustQuantity(entry, val - entry.quantity)
                        }}
                        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                        className="w-10 text-center text-sm text-fg-soft bg-surface-muted border border-outline rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-focus disabled:opacity-40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <button
                        onClick={() => adjustQuantity(entry, +1)}
                        disabled={adjustingId === entry.id || removingId === entry.id}
                        className="w-6 h-6 flex items-center justify-center rounded text-fg-faint hover:bg-surface-strong hover:text-fg-mid disabled:opacity-40 cursor-pointer text-base leading-none"
                      >+</button>
                    </div>
                    <button
                      onClick={() => removeFromInventory(entry.id)}
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

      {/* Printings popover — rendered outside the scroll container as position:fixed */}
      {hoveredEntryId && popoverStyle && (
        <div
          style={popoverStyle}
          className="max-h-72 overflow-y-auto bg-surface-muted border border-outline rounded-lg shadow-lg"
          onMouseEnter={onPopoverEnter}
          onMouseLeave={closePopover}
        >
          {loadingPrintings ? (
            <p className="text-xs text-fg-faint p-3">Finding other printings…</p>
          ) : printings.length === 0 ? (
            <p className="text-xs text-fg-faint p-3">No other printings found.</p>
          ) : (
            <ul className="p-1.5 flex flex-col gap-0.5">
              {printings.map((printing) => (
                <li key={printing.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-surface-strong">
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
