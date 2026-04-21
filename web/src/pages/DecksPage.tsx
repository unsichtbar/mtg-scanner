import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, Deck } from '../api'

export default function DecksPage() {
  const [decks, setDecks] = useState<Deck[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [format, setFormat] = useState<'standard' | 'commander'>('standard')
  const [creating, setCreating] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    api.decks.list().then(setDecks).finally(() => setLoading(false))
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setCreating(true)
    try {
      const deck = await api.decks.create(name.trim(), format)
      navigate(`/decks/${deck.id}`)
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(id: string) {
    await api.decks.delete(id)
    setDecks((prev) => prev.filter((d) => d.id !== id))
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-slate-800">Decks</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors cursor-pointer"
        >
          {showForm ? 'Cancel' : '+ New Deck'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col gap-3">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Deck name"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
          <div className="flex gap-2">
            {(['standard', 'commander'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFormat(f)}
                className={`flex-1 py-1.5 text-sm font-medium rounded-lg border transition-colors cursor-pointer capitalize ${
                  format === f
                    ? 'bg-slate-800 text-white border-slate-800'
                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <button
            type="submit"
            disabled={creating || !name.trim()}
            className="py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {creating ? 'Creating…' : 'Create Deck'}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-slate-400 text-sm text-center py-12">Loading…</p>
      ) : decks.length === 0 ? (
        <p className="text-slate-400 text-sm text-center py-12">No decks yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {decks.map((deck) => (
            <li key={deck.id} className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 hover:border-slate-300 transition-colors">
              <Link to={`/decks/${deck.id}`} className="flex-1 min-w-0">
                <p className="font-medium text-slate-800 truncate">{deck.name}</p>
                <p className="text-xs text-slate-400 capitalize">{deck.format}</p>
              </Link>
              <button
                onClick={() => handleDelete(deck.id)}
                className="text-slate-300 hover:text-red-400 transition-colors text-lg leading-none cursor-pointer"
                title="Delete deck"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
