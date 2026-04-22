import { createFileRoute } from '@tanstack/react-router'
import FinancePage from '../pages/FinancePage'

export const Route = createFileRoute('/finance')({
  component: FinancePage,
})
