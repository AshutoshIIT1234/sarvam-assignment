import { describe, it, expect } from 'vitest'
import { semanticSimilarity, PARAPHRASE_THRESHOLD } from '../utils/semanticSimilarity'

describe('semanticSimilarity', () => {
  it('returns 1.0 for identical tokens', () => {
    expect(semanticSimilarity('hello', 'hello')).toBe(1.0)
  })

  it('is case-insensitive', () => {
    expect(semanticSimilarity('Car', 'vehicle')).toBe(semanticSimilarity('car', 'vehicle'))
  })

  it('returns high score for known synonyms', () => {
    expect(semanticSimilarity('car', 'vehicle')).toBeGreaterThanOrEqual(PARAPHRASE_THRESHOLD)
    expect(semanticSimilarity('fast', 'quick')).toBeGreaterThanOrEqual(PARAPHRASE_THRESHOLD)
    expect(semanticSimilarity('large', 'big')).toBeGreaterThanOrEqual(PARAPHRASE_THRESHOLD)
  })

  it('returns low score for antonyms', () => {
    expect(semanticSimilarity('fast', 'slow')).toBeLessThan(PARAPHRASE_THRESHOLD)
    expect(semanticSimilarity('happy', 'sad')).toBeLessThan(PARAPHRASE_THRESHOLD)
  })

  it('is symmetric — order should not matter', () => {
    expect(semanticSimilarity('car', 'vehicle')).toBe(semanticSimilarity('vehicle', 'car'))
  })

  it('returns a value in [0, 1] for unknown words (Jaccard fallback)', () => {
    const score = semanticSimilarity('xyzfoo', 'xyzbar')
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(1)
  })

  it('returns 0 for completely unrelated short tokens', () => {
    // "abc" vs "xyz" share no characters
    expect(semanticSimilarity('abc', 'xyz')).toBe(0)
  })
})
