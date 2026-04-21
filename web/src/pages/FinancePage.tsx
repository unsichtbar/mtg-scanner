import { useEffect, useState } from 'react'
import { api, InventoryEntry } from '../api'

function cardValue(entry: InventoryEntry): number {
  const usd = parseFloat(entry.card.prices?.usd ?? '')
  return isNaN(usd) ? 0 : usd * entry.quantity
}

function fmt(value: number) {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export default function FinancePage() {
  const [inventory, setInventory] = useState<InventoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.inventory.list().then(setInventory).finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-slate-400 text-sm text-center py-24">Loading…</p>

  const totalValue = inventory.reduce((sum, e) => sum + cardValue(e), 0)
  const totalCards = inventory.reduce((sum, e) => sum + e.quantity, 0)
  const unpriced = inventory.filter((e) => !e.card.prices?.usd)

  // Top cards by total value (quantity × price)
  const topCards = [...inventory]
    .filter((e) => e.card.prices?.usd)
    .sort((a, b) => cardValue(b) - cardValue(a))
    .slice(0, 10)

  // Value by set
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

  // Value by rarity
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
    uncommon: 'text-slate-400',
    common: 'text-slate-300',
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-slate-800 mb-6">Finance</h1>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-4">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Total value</p>
          <p className="text-2xl font-bold text-slate-800">{fmt(totalValue)}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-4">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Unique cards</p>
          <p className="text-2xl font-bold text-slate-800">{inventory.length}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-4">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Total copies</p>
          <p className="text-2xl font-bold text-slate-800">{totalCards}</p>
        </div>
      </div>

      {/* Top cards */}
      {topCards.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-2">Most valuable cards</h2>
          <ul className="flex flex-col gap-1.5">
            {topCards.map((entry) => (
              <li key={entry.id} className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg px-3 py-2">
                {entry.card.imageUri && (
                  <img src={entry.card.imageUri} alt={entry.card.name} className="w-8 rounded shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{entry.card.name}</p>
                  <p className="text-xs text-slate-400">{entry.card.setName} · ×{entry.quantity}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-slate-800">{fmt(cardValue(entry))}</p>
                  <p className="text-xs text-slate-400">{fmt(parseFloat(entry.card.prices!.usd!))} each</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Value by set */}
      {setRows.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-2">Value by set</h2>
          <ul className="flex flex-col gap-1.5">
            {setRows.map((row) => (
              <li key={row.code} className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg px-3 py-2">
                <span className="text-xs font-mono text-slate-400 uppercase w-10 shrink-0">{row.code}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{row.name}</p>
                  <p className="text-xs text-slate-400">{row.count} cop{row.count === 1 ? 'y' : 'ies'}</p>
                </div>
                <p className="text-sm font-semibold text-slate-800 shrink-0">{fmt(row.value)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Value by rarity */}
      {rarityRows.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-2">Value by rarity</h2>
          <ul className="flex flex-col gap-1.5">
            {rarityRows.map(([rarity, value]) => (
              <li key={rarity} className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg px-3 py-2">
                <span className={`text-sm font-medium capitalize w-24 shrink-0 ${rarityColor[rarity] ?? 'text-slate-400'}`}>{rarity}</span>
                <div className="flex-1">
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-slate-400 rounded-full"
                      style={{ width: `${totalValue > 0 ? (value / totalValue) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                <p className="text-sm font-semibold text-slate-800 shrink-0 w-20 text-right">{fmt(value)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Unpriced */}
      {unpriced.length > 0 && (
        <section>
          <h2 className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-2">
            No price data · {unpriced.length} card{unpriced.length !== 1 ? 's' : ''}
          </h2>
          <ul className="flex flex-col gap-1.5">
            {unpriced.map((entry) => (
              <li key={entry.id} className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg px-3 py-2">
                {entry.card.imageUri && (
                  <img src={entry.card.imageUri} alt={entry.card.name} className="w-8 rounded shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{entry.card.name}</p>
                  <p className="text-xs text-slate-400">{entry.card.setName}</p>
                </div>
                <span className="text-xs text-slate-300 shrink-0">no price</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {inventory.length === 0 && (
        <p className="text-slate-400 text-sm text-center py-12">No cards in inventory yet.</p>
      )}
    </div>
  )
}
