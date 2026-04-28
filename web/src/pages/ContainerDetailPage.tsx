import { useEffect, useState, useRef } from 'react'
import { Link } from '@tanstack/react-router'
import { api, ContainerDetail, ContainerCard, InventoryEntry } from '../api'
import { Route } from '../routes/containers.$id'

export default function ContainerDetailPage() {
  const { id } = Route.useParams()
  const [container, setContainer] = useState<ContainerDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [inventory, setInventory] = useState<InventoryEntry[]>([])
  const [query, setQuery] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [adjustingId, setAdjustingId] = useState<string | null>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    Promise.all([
      api.containers.get(id),
      api.inventory.list(),
    ]).then(([c, inv]) => {
      setContainer(c)
      setNameInput(c.name)
      setInventory(inv)
    }).finally(() => setLoading(false))
  }, [id])

  async function handleRename(e: React.FormEvent) {
    e.preventDefault()
    if (!nameInput.trim() || !container) return
    const updated = await api.containers.rename(id, nameInput.trim())
    setContainer((prev) => prev ? { ...prev, name: updated.name } : prev)
    setRenaming(false)
  }

  async function handleAdd(entry: InventoryEntry) {
    if (!container) return
    const cc = await api.containers.addCard(id, entry.card.id, 1)
    setContainer((prev) => {
      if (!prev) return prev
      const existing = prev.cards.find((c) => c.card.id === entry.card.id)
      if (existing) {
        return { ...prev, cards: prev.cards.map((c) => c.card.id === entry.card.id ? cc : c) }
      }
      return { ...prev, cards: [...prev.cards, cc] }
    })
  }

  async function handleAdjust(cc: ContainerCard, delta: number) {
    const newQty = cc.quantity + delta
    setAdjustingId(cc.id)
    try {
      if (newQty <= 0) {
        await api.containers.removeCard(id, cc.card.id)
        setContainer((prev) => prev ? { ...prev, cards: prev.cards.filter((c) => c.id !== cc.id) } : prev)
      } else {
        const updated = await api.containers.setCardQuantity(id, cc.card.id, newQty)
        if (updated) setContainer((prev) => prev ? { ...prev, cards: prev.cards.map((c) => c.id === cc.id ? updated : c) } : prev)
      }
    } finally {
      setAdjustingId(null)
    }
  }

  if (loading) return <div className="max-w-2xl mx-auto px-4 py-10"><p className="text-fg-faint text-sm text-center py-12">Loading…</p></div>
  if (!container) return null

  const containerCardIds = new Set(container.cards.map((c) => c.card.id))
  const filteredInventory = query.trim()
    ? inventory.filter((e) => e.card.name.toLowerCase().includes(query.toLowerCase()))
    : inventory

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/containers" className="text-fg-faint hover:text-fg text-sm transition-colors">← Containers</Link>
        <span className="text-fg-faint">/</span>
        {renaming ? (
          <form onSubmit={handleRename} className="flex items-center gap-2 flex-1">
            <input
              ref={nameInputRef}
              autoFocus
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              className="flex-1 px-2 py-1 border border-outline-strong rounded-lg text-lg font-bold text-fg bg-surface-muted focus:outline-none focus:ring-2 focus:ring-focus"
            />
            <button type="submit" className="text-xs px-2 py-1 rounded border border-outline bg-surface-muted text-fg-soft hover:bg-surface-strong cursor-pointer">Save</button>
            <button type="button" onClick={() => setRenaming(false)} className="text-xs text-fg-faint hover:text-fg cursor-pointer">Cancel</button>
          </form>
        ) : (
          <button onClick={() => { setRenaming(true) }} className="text-2xl font-bold text-fg hover:underline decoration-fg-ghost text-left cursor-pointer">
            {container.name}
          </button>
        )}
      </div>

      <section className="mb-8">
        <h2 className="text-xs font-medium uppercase tracking-wide text-fg-faint mb-2">Add from inventory</h2>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter inventory…"
          className="w-full px-3 py-2 border border-outline-strong rounded-lg text-sm bg-surface-muted text-fg placeholder:text-fg-faint focus:outline-none focus:ring-2 focus:ring-focus mb-2"
        />
        {filteredInventory.length > 0 && (
          <ul className="flex flex-col gap-1.5 max-h-64 overflow-y-auto">
            {filteredInventory.map((entry) => (
              <li key={entry.id} className="flex items-center gap-3 border border-outline rounded-lg px-3 py-2 bg-surface-muted">
                {entry.card.imageUri && <img src={entry.card.imageUri} alt={entry.card.name} className="w-8 rounded shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-fg truncate">{entry.card.name}</p>
                  <p className="text-xs text-fg-faint">{entry.card.setName}</p>
                </div>
                <span className="text-xs text-fg-muted shrink-0">×{entry.quantity} owned</span>
                <button
                  onClick={() => handleAdd(entry)}
                  disabled={containerCardIds.has(entry.card.id)}
                  className="text-xs px-2.5 py-1 rounded-lg font-medium transition-colors disabled:opacity-40 cursor-pointer shrink-0 bg-surface-muted text-fg-soft hover:bg-surface-strong border border-outline"
                >
                  {containerCardIds.has(entry.card.id) ? 'In container' : 'Add'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-xs font-medium uppercase tracking-wide text-fg-faint mb-2">
          Contents · {container.cards.length} card{container.cards.length !== 1 ? 's' : ''}
        </h2>
        {container.cards.length === 0 ? (
          <p className="text-fg-faint text-sm text-center py-8">No cards yet. Add some from your inventory above.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {container.cards.sort((a, b) => a.card.name.localeCompare(b.card.name)).map((cc) => (
              <li key={cc.id} className="flex items-center gap-3 border border-outline rounded-lg px-3 py-2 bg-surface-muted">
                {cc.card.imageUri && <img src={cc.card.imageUri} alt={cc.card.name} className="w-8 rounded shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-fg truncate">{cc.card.name}</p>
                  <p className="text-xs text-fg-faint">{cc.card.setName}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleAdjust(cc, -1)}
                    disabled={adjustingId === cc.id}
                    className="w-6 h-6 flex items-center justify-center rounded text-fg-faint hover:bg-surface-strong hover:text-fg-mid disabled:opacity-40 cursor-pointer text-base leading-none"
                  >−</button>
                  <span className="w-6 text-center text-sm text-fg-soft">{cc.quantity}</span>
                  <button
                    onClick={() => handleAdjust(cc, +1)}
                    disabled={adjustingId === cc.id}
                    className="w-6 h-6 flex items-center justify-center rounded text-fg-faint hover:bg-surface-strong hover:text-fg-mid disabled:opacity-40 cursor-pointer text-base leading-none"
                  >+</button>
                </div>
                <button
                  onClick={() => handleAdjust(cc, -cc.quantity)}
                  disabled={adjustingId === cc.id}
                  className="text-fg-ghost hover:text-red-400 transition-colors text-lg leading-none disabled:opacity-40 cursor-pointer"
                >×</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
