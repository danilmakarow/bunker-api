/**
 * Categories that a Trait card can belong to. Maps to a Postgres ENUM type.
 * - HEALTH .. PERSONAL_FACT are personal-card kinds drawn at game start.
 * - ACTION_CARD / CONDITION_CARD are gameplay cards used during the run.
 *
 * Source content (`bunker_cards_ua_v7.xlsx`) covers every kind except
 * CONDITION_CARD; the value is reserved for future content.
 */
export enum TraitKindEnum {
  HEALTH = 'HEALTH',
  PROFESSION = 'PROFESSION',
  HOBBY = 'HOBBY',
  PHOBIA = 'PHOBIA',
  CHARACTER_TRAIT = 'CHARACTER_TRAIT',
  LUGGAGE = 'LUGGAGE',
  PERSONAL_FACT = 'PERSONAL_FACT',
  ACTION_CARD = 'ACTION_CARD',
  CONDITION_CARD = 'CONDITION_CARD',
}
