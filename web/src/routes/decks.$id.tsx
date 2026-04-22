import { createFileRoute } from '@tanstack/react-router'
import DeckBuilderPage from '../pages/DeckBuilderPage'

export const Route = createFileRoute('/decks/$id')({
  component: DeckBuilderPage,
})
