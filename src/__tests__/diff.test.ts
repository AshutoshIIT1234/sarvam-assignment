import { describe, it, expect } from 'vitest'
import { tokenize, computeTokenDiff, getSummary, changeScore } from '../utils/diff'

describe('tokenize', () => {
  it('splits on words and punctuation', () => {
    expect(tokenize('hello, world!')).toEqual(['hello', ',', 'world', '!'])
  })

  it('returns empty array for empty string', () => {
    expect(tokenize('')).toEqual([])
  })

  it('handles multiple spaces gracefully', () => {
    expect(tokenize('a  b')).toEqual(['a', 'b'])
  })
})

describe('computeTokenDiff', () => {
  it('returns empty for two empty strings', () => {
    expect(computeTokenDiff('', '')).toEqual([])
  })

  it('marks all tokens as added when A is empty', () => {
    const result = computeTokenDiff('', 'hello world')
    expect(result.every((t) => t.state === 'added')).toBe(true)
  })

  it('marks all tokens as deleted when B is empty', () => {
    const result = computeTokenDiff('hello world', '')
    expect(result.every((t) => t.state === 'deleted')).toBe(true)
  })

  it('marks identical text as all equal', () => {
    const result = computeTokenDiff('the cat sat', 'the cat sat')
    expect(result.every((t) => t.state === 'equal')).toBe(true)
  })

  it('detects a paraphrase for known synonym pairs', () => {
    // "car" → "vehicle" is in the similarity map with score 0.92
    const result = computeTokenDiff('the car was fast', 'the vehicle was fast')
    const paraphrased = result.filter((t) => t.state === 'paraphrased')
    expect(paraphrased).toHaveLength(1)
    expect(paraphrased[0].tokenA).toBe('car')
    expect(paraphrased[0].tokenB).toBe('vehicle')
  })

  it('marks unrelated word swap as delete + add', () => {
    // "cat" → "elephant" — no semantic similarity
    const result = computeTokenDiff('the cat sat', 'the elephant sat')
    const states = result.map((t) => t.state)
    expect(states).toContain('deleted')
    expect(states).toContain('added')
    expect(states).not.toContain('paraphrased')
  })
})

describe('getSummary', () => {
  it('counts added, removed, and paraphrased correctly', () => {
    const diff = computeTokenDiff('the car was fast', 'the vehicle was quick and smooth')
    const summary = getSummary(diff)
    expect(summary.added).toBeGreaterThan(0)
    expect(summary.paraphrased).toBeGreaterThan(0)
  })

  it('returns zeros for identical text', () => {
    const diff = computeTokenDiff('same text', 'same text')
    expect(getSummary(diff)).toEqual({ added: 0, removed: 0, paraphrased: 0 })
  })
})

describe('changeScore', () => {
  it('returns 0 for identical text', () => {
    const diff = computeTokenDiff('hello world', 'hello world')
    expect(changeScore(diff)).toBe(0)
  })

  it('returns 100 for completely different text', () => {
    const diff = computeTokenDiff('aaa bbb', 'ccc ddd')
    expect(changeScore(diff)).toBe(100)
  })

  it('returns a value between 0 and 100 for partial changes', () => {
    const diff = computeTokenDiff('the cat sat on the mat', 'the dog sat on the mat')
    const score = changeScore(diff)
    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThan(100)
  })
})
