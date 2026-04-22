import { createFileRoute } from '@tanstack/react-router'
import CardPage from '../pages/CardPage'

export const Route = createFileRoute('/cards')({
  component: CardPage,
})
