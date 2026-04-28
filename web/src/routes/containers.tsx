import { createFileRoute } from '@tanstack/react-router'
import ContainersPage from '../pages/ContainersPage'

export const Route = createFileRoute('/containers')({
  component: ContainersPage,
})
