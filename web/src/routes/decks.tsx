import { createFileRoute } from '@tanstack/react-router'
import DecksPage from '../pages/DecksPage'

export const Route = createFileRoute('/decks')({
  component: DecksPage,
})
