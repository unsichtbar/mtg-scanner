import { createFileRoute } from '@tanstack/react-router'
import ContainerDetailPage from '../pages/ContainerDetailPage'

export const Route = createFileRoute('/containers/$id')({
  component: ContainerDetailPage,
})
