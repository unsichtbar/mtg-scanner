import { describe, it, expect } from 'vitest'
import { formatManaCost } from './manaSymbols'

describe('formatManaCost', () => {
  it('should format a single colour symbol', () => {
    expect(formatManaCost('{W}')).toBe('1 x White')
  })

  it('should format two different colour symbols', () => {
    expect(formatManaCost('{B}{U}')).toBe('1 x Black\n1 x Blue')
  })

  it('should count repeated colour symbols', () => {
    expect(formatManaCost('{R}{R}')).toBe('2 x Red')
  })

  it('should sum numeric symbols as Generic mana', () => {
    expect(formatManaCost('{3}')).toBe('3 x Generic')
  })

  it('should combine generic and coloured mana', () => {
    expect(formatManaCost('{2}{R}{R}')).toBe('2 x Generic\n2 x Red')
  })

  it('should handle {X} as X', () => {
    expect(formatManaCost('{X}')).toBe('1 x X')
  })

  it('should format hybrid mana symbols', () => {
    expect(formatManaCost('{W/U}')).toBe('1 x White/Blue')
  })

  it('should format Phyrexian mana symbols', () => {
    expect(formatManaCost('{W/P}')).toBe('1 x White/Phyrexian')
  })

  it('should format a zero-cost card', () => {
    expect(formatManaCost('{0}')).toBe('0 x Generic')
  })

  it('should return an empty string for empty input', () => {
    expect(formatManaCost('')).toBe('')
  })

  it('should handle five-colour mana costs', () => {
    expect(formatManaCost('{W}{U}{B}{R}{G}')).toBe(
      '1 x White\n1 x Blue\n1 x Black\n1 x Red\n1 x Green',
    )
  })
})
