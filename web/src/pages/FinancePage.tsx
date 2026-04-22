import { useEffect, useState, createContext, useContext } from 'react'
import { api, InventoryEntry } from '../api'
import CardRow from '../components/CardRow'
import { Link } from '@tanstack/react-router'

// --- Helpers ---

function cardValue(entry: InventoryEntry): number {
  const usd = parseFloat(entry.card.prices?.usd ?? '')
  return isNaN(usd) ? 0 : usd * entry.quantity
}

function fmt(value: number) {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

// --- Context ---

interface FinanceCtx {
  inventory: InventoryEntry[]
  loading: boolean
  totalValue: number
  totalCards: number
  topCards: InventoryEntry[]
  setRows: { code: string; name: string; value: number; count: number }[]
  rarityRows: [string, number][]
  rarityColor: Record<string, string>
  unpriced: InventoryEntry[]
}

const FinanceContext = createContext<FinanceCtx | null>(null)

function useFinance() {
  const ctx = useContext(FinanceContext)
  if (!ctx) throw new Error('Must be used inside <Finance>')
  return ctx
}

// --- Compound component ---

function Finance({ children }: { children: React.ReactNode }) {
  const [inventory, setInventory] = useState<InventoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.inventory.list().then(setInventory).finally(() => setLoading(false))
  }, [])

  const totalValue = inventory.reduce((sum, e) => sum + cardValue(e), 0)
  const totalCards = inventory.reduce((sum, e) => sum + e.quantity, 0)
  const unpriced = inventory.filter((e) => !e.card.prices?.usd)

  const topCards = [...inventory]
    .filter((e) => e.card.prices?.usd)
    .sort((a, b) => cardValue(b) - cardValue(a))
    .slice(0, 10)

  const bySet = new Map<string, { name: string; value: number; count: number }>()
  for (const entry of inventory) {
    const val = cardValue(entry)
    const existing = bySet.get(entry.card.setCode)
    if (existing) {
      existing.value += val
      existing.count += entry.quantity
    } else {
      bySet.set(entry.card.setCode, { name: entry.card.setName, value: val, count: entry.quantity })
    }
  }
  const setRows = [...bySet.entries()]
    .map(([code, data]) => ({ code, ...data }))
    .sort((a, b) => b.value - a.value)

  const byRarity = new Map<string, number>()
  for (const entry of inventory) {
    const val = cardValue(entry)
    byRarity.set(entry.card.rarity, (byRarity.get(entry.card.rarity) ?? 0) + val)
  }
  const rarityOrder = ['mythic', 'rare', 'uncommon', 'common']
  const rarityRows = [...byRarity.entries()]
    .sort((a, b) => (rarityOrder.indexOf(a[0]) ?? 99) - (rarityOrder.indexOf(b[0]) ?? 99))

  const rarityColor: Record<string, string> = {
    mythic: 'text-orange-500',
    rare: 'text-yellow-500',
    uncommon: 'text-fg-faint',
    common: 'text-fg-ghost',
  }

  return (
    <FinanceContext.Provider value={{ inventory, loading, totalValue, totalCards, topCards, setRows, rarityRows, rarityColor, unpriced }}>
      {children}
    </FinanceContext.Provider>
  )
}

Finance.Summary = function Summary() {
  const { loading, totalValue, inventory, totalCards } = useFinance()
  if (loading) return <p className="text-fg-faint text-sm text-center py-24">Loading…</p>
  return (
    <div className="grid grid-cols-3 gap-3 mb-8">
      <div className="bg-white border border-outline rounded-xl px-4 py-4">
        <p className="text-xs text-fg-faint uppercase tracking-wide mb-1">Total value</p>
        <p className="text-2xl font-bold text-fg">{fmt(totalValue)}</p>
      </div>
      <div className="bg-white border border-outline rounded-xl px-4 py-4">
        <p className="text-xs text-fg-faint uppercase tracking-wide mb-1">Unique cards</p>
        <p className="text-2xl font-bold text-fg">{inventory.length}</p>
      </div>
      <div className="bg-white border border-outline rounded-xl px-4 py-4">
        <p className="text-xs text-fg-faint uppercase tracking-wide mb-1">Total copies</p>
        <p className="text-2xl font-bold text-fg">{totalCards}</p>
      </div>
    </div>
  )
}

Finance.TopCards = function TopCards() {
  const { topCards } = useFinance()
  if (topCards.length === 0) return null
  return (
    <section className="mb-8">
      <h2 className="text-xs font-medium uppercase tracking-wide text-fg-faint mb-2">Most valuable cards</h2>
      <ul className="flex flex-col gap-1.5">
        {topCards.map((entry) => (
          <CardRow
            key={entry.id}
            card={entry.card}
            subtitle={`${entry.card.setName} · ×${entry.quantity}`}
            to="/cards"
            toState={{ card: entry.card }}
          >
            <div className="text-right shrink-0">
              <p className="text-sm font-semibold text-fg">{fmt(cardValue(entry))}</p>
              <p className="text-xs text-fg-faint">{fmt(parseFloat(entry.card.prices!.usd!))} each</p>
            </div>
          </CardRow>
        ))}
      </ul>
    </section>
  )
}

Finance.BySet = function BySet() {
  const { setRows } = useFinance()
  if (setRows.length === 0) return null
  return (
    <section className="mb-8">
      <h2 className="text-xs font-medium uppercase tracking-wide text-fg-faint mb-2">Value by set</h2>
      <ul className="flex flex-col gap-1.5">
        {setRows.map((row) => (
          <li key={row.code}>
            <Link
              to="/inventory"
              search={{ set: row.code }}
              className="flex items-center gap-3 bg-white border border-outline rounded-lg px-3 py-2 hover:border-outline-strong transition-colors"
            >
              <span className="text-xs font-mono text-fg-faint uppercase w-10 shrink-0">{row.code}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-fg truncate">{row.name}</p>
                <p className="text-xs text-fg-faint">{row.count} cop{row.count === 1 ? 'y' : 'ies'}</p>
              </div>
              <p className="text-sm font-semibold text-fg shrink-0">{fmt(row.value)}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

Finance.ByRarity = function ByRarity() {
  const { rarityRows, rarityColor, totalValue } = useFinance()
  if (rarityRows.length === 0) return null
  return (
    <section className="mb-8">
      <h2 className="text-xs font-medium uppercase tracking-wide text-fg-faint mb-2">Value by rarity</h2>
      <ul className="flex flex-col gap-1.5">
        {rarityRows.map(([rarity, value]) => (
          <li key={rarity} className="flex items-center gap-3 bg-white border border-outline rounded-lg px-3 py-2">
            <span className={`text-sm font-medium capitalize w-24 shrink-0 ${rarityColor[rarity] ?? 'text-fg-faint'}`}>{rarity}</span>
            <div className="flex-1">
              <div className="h-1.5 bg-surface-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-fg-faint rounded-full"
                  style={{ width: `${totalValue > 0 ? (value / totalValue) * 100 : 0}%` }}
                />
              </div>
            </div>
            <p className="text-sm font-semibold text-fg shrink-0 w-20 text-right">{fmt(value)}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}

Finance.Unpriced = function Unpriced() {
  const { unpriced, inventory } = useFinance()
  if (inventory.length === 0) {
    return <p className="text-fg-faint text-sm text-center py-12">No cards in inventory yet.</p>
  }
  if (unpriced.length === 0) return null
  return (
    <section>
      <h2 className="text-xs font-medium uppercase tracking-wide text-fg-faint mb-2">
        No price data · {unpriced.length} card{unpriced.length !== 1 ? 's' : ''}
      </h2>
      <ul className="flex flex-col gap-1.5">
        {unpriced.map((entry) => (
          <CardRow key={entry.id} card={entry.card} subtitle={entry.card.setName}>
            <span className="text-xs text-fg-ghost shrink-0">no price</span>
          </CardRow>
        ))}
      </ul>
    </section>
  )
}

// --- Page ---

export default function FinancePage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-fg mb-6">Finance</h1>
      <Finance>
        <Finance.Summary />
        <Finance.TopCards />
        <Finance.BySet />
        <Finance.ByRarity />
        <Finance.Unpriced />
      </Finance>
    </div>
  )
}
