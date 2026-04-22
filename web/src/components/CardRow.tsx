import { Link } from 'react-router-dom'
import { Card } from '../api'

interface CardRowProps {
  card: Card
  /** String renders as a styled <p>; ReactNode renders as-is inside the identity block */
  subtitle?: React.ReactNode
  /** Highlights row with emerald background (e.g. card already in deck) */
  highlight?: boolean
  /** Makes the entire row a link */
  to?: string
  toState?: unknown
  /** Makes only the name+subtitle block a link */
  nameLink?: string
  nameLinkState?: unknown
  children?: React.ReactNode
}

export default function CardRow({
  card, subtitle, highlight = false,
  to, toState, nameLink, nameLinkState,
  children,
}: CardRowProps) {
  const rowCls = `flex items-center gap-3 border rounded-lg px-3 py-2 ${
    highlight ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'
  }${to ? ' hover:border-slate-300 transition-colors' : ''}`

  const image = card.imageUri
    ? <img src={card.imageUri} alt={card.name} className="w-8 rounded shrink-0" />
    : null

  const subtitleEl = subtitle === undefined ? null
    : typeof subtitle === 'string'
      ? <p className="text-xs text-slate-400">{subtitle}</p>
      : subtitle

  const identity = nameLink ? (
    <Link to={nameLink} state={nameLinkState} className="flex-1 min-w-0 hover:underline decoration-slate-300">
      <p className="text-sm font-medium text-slate-800 truncate">{card.name}</p>
      {subtitleEl}
    </Link>
  ) : (
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-slate-800 truncate">{card.name}</p>
      {subtitleEl}
    </div>
  )

  if (to) {
    return (
      <li>
        <Link to={to} state={toState} className={rowCls}>
          {image}
          {identity}
          {children}
        </Link>
      </li>
    )
  }

  return (
    <li className={rowCls}>
      {image}
      {identity}
      {children}
    </li>
  )
}
