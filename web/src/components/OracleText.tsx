import { MTG_KEYWORDS } from '../data/mtgKeywords'

// Build a regex that matches any known keyword (longest first to avoid partial matches)
const keywords = Object.keys(MTG_KEYWORDS).sort((a, b) => b.length - a.length)
const keywordRegex = new RegExp(`\\b(${keywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'gi')

const SYMBOL_MAP: Record<string, string> = {
  T: 'Tap', Q: 'Untap', E: 'Energy',
  W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green', C: 'Colorless',
  S: 'Snow', X: 'X', Y: 'Y', Z: 'Z',
  P: 'Phyrexian',
}

function expandSymbols(line: string): string {
  return line.replace(/\{([^}]+)\}/g, (_, inner: string) => {
    // Generic/numeric mana: {0}–{9}, {10}, etc.
    if (/^\d+$/.test(inner)) return inner
    // Hybrid mana like {W/U}, {2/W}, phyrexian like {W/P}
    if (inner.includes('/')) return `{${inner}}`
    return SYMBOL_MAP[inner.toUpperCase()] ?? `{${inner}}`
  })
}

interface Props {
  text: string
}

export default function OracleText({ text }: Props) {
  const lines = text.split('\n')

  return (
    <div className="flex flex-col gap-1">
      {lines.map((line, i) => (
        <p key={i} className="text-xs text-fg-soft leading-relaxed">
          {tokenize(expandSymbols(line))}
        </p>
      ))}
    </div>
  )
}

function tokenize(line: string) {
  const parts: React.ReactNode[] = []
  let last = 0
  let match: RegExpExecArray | null

  keywordRegex.lastIndex = 0
  while ((match = keywordRegex.exec(line)) !== null) {
    if (match.index > last) parts.push(line.slice(last, match.index))
    const keyword = match[1]
    const canonical = Object.keys(MTG_KEYWORDS).find((k) => k.toLowerCase() === keyword.toLowerCase())
    const tooltip = canonical ? MTG_KEYWORDS[canonical] : null
    parts.push(
      tooltip ? (
        <span key={match.index} className="relative group/kw inline">
          <span className="underline decoration-dotted decoration-fg-faint cursor-help">{keyword}</span>
          <span className="
            pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-20
            w-56 rounded-lg bg-accent text-white text-xs px-3 py-2 leading-snug shadow-lg
            opacity-0 group-hover/kw:opacity-100 transition-opacity
          ">
            <strong className="block mb-0.5">{canonical}</strong>
            {tooltip}
            <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-accent" />
          </span>
        </span>
      ) : keyword
    )
    last = match.index + keyword.length
  }
  if (last < line.length) parts.push(line.slice(last))
  return parts
}
