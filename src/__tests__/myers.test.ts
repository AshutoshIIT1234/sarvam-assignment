import { describe, it, expect } from 'vitest'
import { myersDiff } from '../utils/myers'

describe('myersDiff', () => {
  it('returns empty array for two empty sequences', () => {
    expect(myersDiff([], [])).toEqual([])
  })

  it('marks all tokens as inserts when A is empty', () => {
    const result = myersDiff([], ['hello', 'world'])
    expect(result).toEqual([
      { type: 'insert', tokenB: 'hello' },
      { type: 'insert', tokenB: 'world' },
    ])
  })

  it('marks all tokens as deletes when B is empty', () => {
    const result = myersDiff(['hello', 'world'], [])
    expect(result).toEqual([
      { type: 'delete', tokenA: 'hello' },
      { type: 'delete', tokenA: 'world' },
    ])
  })

  it('marks all tokens as equal for identical sequences', () => {
    const result = myersDiff(['a', 'b', 'c'], ['a', 'b', 'c'])
    expect(result.every((e) => e.type === 'equal')).toBe(true)
    expect(result).toHaveLength(3)
  })

  it('produces minimal edits for a single substitution', () => {
    // "the cat sat" → "the dog sat": only "cat" changes
    const result = myersDiff(['the', 'cat', 'sat'], ['the', 'dog', 'sat'])
    const types = result.map((e) => e.type)
    expect(types).toContain('delete')
    expect(types).toContain('insert')
    // "the" and "sat" should be equal
    const equalTokens = result.filter((e) => e.type === 'equal').map((e) => e.tokenA)
    expect(equalTokens).toContain('the')
    expect(equalTokens).toContain('sat')
  })

  it('handles completely different sequences', () => {
    const result = myersDiff(['a', 'b'], ['c', 'd'])
    expect(result.filter((e) => e.type === 'delete')).toHaveLength(2)
    expect(result.filter((e) => e.type === 'insert')).toHaveLength(2)
  })

  it('finds the shortest edit script (minimum edits)', () => {
    // Only one token differs — should be 1 delete + 1 insert, not more
    const result = myersDiff(['x', 'y', 'z'], ['x', 'w', 'z'])
    const edits = result.filter((e) => e.type !== 'equal')
    expect(edits).toHaveLength(2) // 1 delete + 1 insert
  })
})
