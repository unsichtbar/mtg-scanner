export const MANA_SYMBOL_NAMES: Record<string, string> = {
  W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green',
  C: 'Colorless', S: 'Snow', X: 'X', Y: 'Y', Z: 'Z',
  T: 'Tap', Q: 'Untap', E: 'Energy', P: 'Phyrexian',
}

export function formatManaCost(manaCost: string): string {
  const symbols = [...manaCost.matchAll(/\{([^}]+)\}/g)].map((m) => m[1])
  let generic = 0
  let hasGeneric = false
  const counts = new Map<string, number>()

  for (const sym of symbols) {
    if (/^\d+$/.test(sym)) {
      generic += parseInt(sym, 10)
      hasGeneric = true
    } else {
      const key = sym.toUpperCase()
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }

  const lines: string[] = []
  if (hasGeneric) lines.push(`${generic} x Generic`)
  for (const [sym, count] of counts) {
    const name = sym.includes('/')
      ? sym.split('/').map((s) => MANA_SYMBOL_NAMES[s] ?? s).join('/')
      : (MANA_SYMBOL_NAMES[sym] ?? sym)
    lines.push(`${count} x ${name}`)
  }

  return lines.join('\n')
}
