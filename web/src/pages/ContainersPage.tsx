import { useEffect, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { api, Container } from '../api'

export default function ContainersPage() {
  const [containers, setContainers] = useState<Container[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    api.containers.list().then(setContainers).finally(() => setLoading(false))
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setCreating(true)
    try {
      const container = await api.containers.create(name.trim())
      navigate({ to: '/containers/$id', params: { id: container.id } })
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(id: string) {
    await api.containers.delete(id)
    setContainers((prev) => prev.filter((c) => c.id !== id))
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-fg">Containers</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-hover transition-colors cursor-pointer"
        >
          {showForm ? 'Cancel' : '+ New Container'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 bg-surface-muted border border-outline rounded-xl p-4 flex gap-3">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Container label (e.g. Binder 1, Trade pile…)"
            className="flex-1 px-3 py-2 border border-outline-strong rounded-lg text-sm bg-surface-muted text-fg placeholder:text-fg-faint focus:outline-none focus:ring-2 focus:ring-focus"
          />
          <button
            type="submit"
            disabled={creating || !name.trim()}
            className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-hover disabled:opacity-50 transition-colors cursor-pointer"
          >
            {creating ? 'Creating…' : 'Create'}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-fg-faint text-sm text-center py-12">Loading…</p>
      ) : containers.length === 0 ? (
        <p className="text-fg-faint text-sm text-center py-12">No containers yet. Create one to start organising your cards.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {containers.map((container) => (
            <li key={container.id} className="flex items-center gap-3 bg-surface-muted border border-outline rounded-xl px-4 py-3 hover:border-outline-strong transition-colors">
              <Link to="/containers/$id" params={{ id: container.id }} className="flex-1 min-w-0">
                <p className="font-medium text-fg truncate">{container.name}</p>
              </Link>
              <button
                onClick={() => handleDelete(container.id)}
                className="text-fg-ghost hover:text-red-400 transition-colors text-lg leading-none cursor-pointer"
                title="Delete container"
              >×</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
