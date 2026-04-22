import { createFileRoute } from '@tanstack/react-router'
import CardScanner from '../components/CardScanner'

export const Route = createFileRoute('/')({
  component: CardScanner,
})
