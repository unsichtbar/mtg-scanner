import { createFileRoute } from '@tanstack/react-router'
import InventoryPage from '../pages/InventoryPage'

export const Route = createFileRoute('/inventory')({
  validateSearch: (search: Record<string, unknown>) => ({
    set: typeof search.set === 'string' ? search.set : undefined,
  }),
  component: InventoryPage,
})
