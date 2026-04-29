import { api, type Card, type InventoryEntry } from '../api'

export interface InventorySnapshot {
  entries: InventoryEntry[]
  loading: boolean
  pendingCardId: string | null
  addedIds: Set<string>
  removingId: string | null
  adjustingId: string | null
  filter: string
  sets: [string, string][]
  visibleEntries: InventoryEntry[]
}

export class Inventory {
  private _entries: InventoryEntry[] = []
  private _loading = true
  private _pendingCardId: string | null = null
  private _addedIds = new Set<string>()
  private _removingId: string | null = null
  private _adjustingId: string | null = null
  private _filter: string

  private listeners = new Set<() => void>()
  private snap: InventorySnapshot

  constructor(initialFilter = '') {
    this._filter = initialFilter
    this.snap = this.buildSnap()
  }

  private buildSnap(): InventorySnapshot {
    const entries = this._entries
    const filter = this._filter
    return {
      entries,
      loading: this._loading,
      pendingCardId: this._pendingCardId,
      addedIds: this._addedIds,
      removingId: this._removingId,
      adjustingId: this._adjustingId,
      filter,
      sets: Array.from(
        new Map(entries.map((e) => [e.card.setCode, e.card.setName])).entries()
      ).sort((a, b) => a[1].localeCompare(b[1])),
      visibleEntries: filter ? entries.filter((e) => e.card.setCode === filter) : entries,
    }
  }

  private notify() {
    this.snap = this.buildSnap()
    this.listeners.forEach((l) => l())
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = (): InventorySnapshot => this.snap

  setFilter(code: string) {
    this._filter = code
    this.notify()
  }

  async load() {
    const entries = await api.inventory.list()
    this._entries = entries
    this._loading = false
    this.notify()
  }

  async add(card: Card): Promise<void> {
    this._pendingCardId = card.id
    this.notify()
    try {
      const entry = await api.inventory.add(card.id)
      this._addedIds = new Set(this._addedIds).add(card.id)
      const existing = this._entries.find((e) => e.card.id === card.id)
      this._entries = existing
        ? this._entries.map((e) => e.card.id === card.id ? { ...e, quantity: entry.quantity } : e)
        : [entry, ...this._entries]
    } finally {
      this._pendingCardId = null
      this.notify()
    }
  }

  async adjustQuantity(entry: InventoryEntry, delta: number): Promise<void> {
    const newQty = entry.quantity + delta
    if (newQty <= 0) return this.remove(entry.id)
    this._adjustingId = entry.id
    this.notify()
    try {
      const updated = await api.inventory.update(entry.id, newQty)
      this._entries = this._entries.map((e) => e.id === entry.id ? { ...e, quantity: updated.quantity } : e)
    } finally {
      this._adjustingId = null
      this.notify()
    }
  }

  async remove(entryId: string): Promise<void> {
    this._removingId = entryId
    this.notify()
    try {
      await api.inventory.remove(entryId)
      this._entries = this._entries.filter((e) => e.id !== entryId)
    } finally {
      this._removingId = null
      this.notify()
    }
  }

  async refresh(): Promise<void> {
    this._entries = await api.inventory.list()
    this.notify()
  }

  async switchVersion(entry: InventoryEntry, newCardId: string): Promise<void> {
    await api.inventory.add(newCardId, 1)
    if (entry.quantity <= 1) {
      await api.inventory.remove(entry.id)
    } else {
      await api.inventory.update(entry.id, entry.quantity - 1)
    }
    await this.refresh()
  }

  async importCsv(file: File): Promise<{ imported: number; errors: string[] }> {
    const result = await api.inventory.importCsv(file)
    if (result.imported > 0) await this.refresh()
    return result
  }

  async importVersionedCsv(file: File): Promise<{ imported: number; errors: string[] }> {
    const result = await api.inventory.importVersionedCsv(file)
    if (result.imported > 0) await this.refresh()
    return result
  }
}
