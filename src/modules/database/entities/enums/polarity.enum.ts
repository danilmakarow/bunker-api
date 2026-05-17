/**
 * Flavour polarity of a card. Mirrors the Ukrainian source ratings:
 *   POSITIVE  = "Добре"
 *   NEUTRAL   = "Нейтральне"
 *   NEGATIVE  = "Погане"
 *
 * Polarity is informational only — character draws are uniform per kind
 * regardless of polarity (TASK.md §6.2).
 */
export enum PolarityEnum {
  POSITIVE = 'POSITIVE',
  NEUTRAL = 'NEUTRAL',
  NEGATIVE = 'NEGATIVE',
}
