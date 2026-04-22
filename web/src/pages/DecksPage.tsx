import { useEffect, useState, createContext, useContext } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { api, Deck } from '../api'

// --- Context ---

interface DeckListCtx {
  decks: Deck[]
  loading: boolean
  showForm: boolean
  setShowForm: (v: boolean) => void
  name: string
  setName: (v: string) => void
  format: 'standard' | 'commander'
  setFormat: (v: 'standard' | 'commander') => void
  creating: boolean
  handleCreate: (e: React.FormEvent) => void
  handleDelete: (id: string) => void
}

const DeckListContext = createContext<DeckListCtx | null>(null)

function useDeckList() {
  const ctx = useContext(DeckListContext)
  if (!ctx) throw new Error('Must be used inside <DeckList>')
  return ctx
}

// --- Compound component ---

function DeckList({ children }: { children: React.ReactNode }) {
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
      navigate({ to: '/decks/$id', params: { id: deck.id } })
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(id: string) {
    await api.decks.delete(id)
    setDecks((prev) => prev.filter((d) => d.id !== id))
  }

  return (
    <DeckListContext.Provider value={{ decks, loading, showForm, setShowForm, name, setName, format, setFormat, creating, handleCreate, handleDelete }}>
      {children}
    </DeckListContext.Provider>
  )
}

DeckList.Header = function Header() {
  const { showForm, setShowForm } = useDeckList()
  return (
    <div className="flex items-center justify-between mb-6">
      <h1 className="text-3xl font-bold text-fg">Decks</h1>
      <button
        onClick={() => setShowForm(!showForm)}
        className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-hover transition-colors cursor-pointer"
      >
        {showForm ? 'Cancel' : '+ New Deck'}
      </button>
    </div>
  )
}

DeckList.CreateForm = function CreateForm() {
  const { showForm, name, setName, format, setFormat, creating, handleCreate } = useDeckList()
  if (!showForm) return null
  return (
    <form onSubmit={handleCreate} className="mb-6 bg-surface border border-outline rounded-xl p-4 flex flex-col gap-3">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Deck name"
        className="w-full px-3 py-2 border border-outline-strong rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-focus"
      />
      <div className="flex gap-2">
        {(['standard', 'commander'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFormat(f)}
            className={`flex-1 py-1.5 text-sm font-medium rounded-lg border transition-colors cursor-pointer capitalize ${
              format === f ? 'bg-accent text-white border-accent' : 'bg-white text-fg-soft border-outline-strong hover:bg-surface'
            }`}
          >
            {f}
          </button>
        ))}
      </div>
      <button
        type="submit"
        disabled={creating || !name.trim()}
        className="py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-hover disabled:opacity-50 transition-colors cursor-pointer"
      >
        {creating ? 'Creating…' : 'Create Deck'}
      </button>
    </form>
  )
}

DeckList.Items = function Items() {
  const { decks, loading, handleDelete } = useDeckList()
  if (loading) return <p className="text-fg-faint text-sm text-center py-12">Loading…</p>
  if (decks.length === 0) return <p className="text-fg-faint text-sm text-center py-12">No decks yet.</p>
  return (
    <ul className="flex flex-col gap-3">
      {decks.map((deck) => (
        <li key={deck.id} className="flex items-center gap-3 bg-white border border-outline rounded-xl px-4 py-3 hover:border-outline-strong transition-colors">
          <Link to="/decks/$id" params={{ id: deck.id }} className="flex-1 min-w-0">
            <p className="font-medium text-fg truncate">{deck.name}</p>
            <p className="text-xs text-fg-faint capitalize">{deck.format}</p>
          </Link>
          <button
            onClick={() => handleDelete(deck.id)}
            className="text-fg-ghost hover:text-red-400 transition-colors text-lg leading-none cursor-pointer"
            title="Delete deck"
          >
            ×
          </button>
        </li>
      ))}
    </ul>
  )
}

// --- Page ---

export default function DecksPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <DeckList>
        <DeckList.Header />
        <DeckList.CreateForm />
        <DeckList.Items />
      </DeckList>
    </div>
  )
}
