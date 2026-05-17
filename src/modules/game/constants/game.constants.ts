import {
  RevealAttributeEnum,
  TraitKindEnum,
} from '@/modules/database/entities';

/**
 * Per-player trait counts at game start (TASK.md §6.1 — locked in §10).
 * Every non-zero count requires the matching trait pool to contain at least
 * one enabled row with `weight > 0`; otherwise `GameService.startGame` aborts
 * with 409 E_CONFLICT. Admins manage the per-row enabled/weight flags from
 * the backoffice (CONDITION_CARD therefore needs at least one row enabled
 * before a game can be started).
 */
export const TRAIT_DRAW_COUNTS: Record<TraitKindEnum, number> = {
  [TraitKindEnum.HEALTH]: 1,
  [TraitKindEnum.PROFESSION]: 1,
  [TraitKindEnum.HOBBY]: 1,
  [TraitKindEnum.PHOBIA]: 1,
  [TraitKindEnum.CHARACTER_TRAIT]: 1,
  [TraitKindEnum.LUGGAGE]: 1,
  [TraitKindEnum.PERSONAL_FACT]: 1,
  [TraitKindEnum.ACTION_CARD]: 2,
  [TraitKindEnum.CONDITION_CARD]: 1,
};

/**
 * Reveal attributes that resolve to a Trait card. Map onto the matching
 * `TraitKindEnum` so we can look up the player's owned cards. The remaining
 * attributes (AGE/WEIGHT/SEX/GENDER/RACE) resolve to BiologyValue entries.
 */
export const TRAIT_KIND_BY_REVEAL_ATTRIBUTE: Partial<
  Record<RevealAttributeEnum, TraitKindEnum>
> = {
  [RevealAttributeEnum.HEALTH]: TraitKindEnum.HEALTH,
  [RevealAttributeEnum.PROFESSION]: TraitKindEnum.PROFESSION,
  [RevealAttributeEnum.HOBBY]: TraitKindEnum.HOBBY,
  [RevealAttributeEnum.PHOBIA]: TraitKindEnum.PHOBIA,
  [RevealAttributeEnum.CHARACTER_TRAIT]: TraitKindEnum.CHARACTER_TRAIT,
  [RevealAttributeEnum.LUGGAGE]: TraitKindEnum.LUGGAGE,
  [RevealAttributeEnum.PERSONAL_FACT]: TraitKindEnum.PERSONAL_FACT,
  [RevealAttributeEnum.ACTION_CARD]: TraitKindEnum.ACTION_CARD,
  [RevealAttributeEnum.CONDITION_CARD]: TraitKindEnum.CONDITION_CARD,
};

/**
 * Reveal attributes that resolve to a biology row on PlayerCharacter.
 * Maps the attribute to the FK column it lives behind.
 */
export const BIOLOGY_REVEAL_ATTRIBUTES = new Set<RevealAttributeEnum>([
  RevealAttributeEnum.AGE,
  RevealAttributeEnum.WEIGHT,
  RevealAttributeEnum.SEX,
  RevealAttributeEnum.GENDER,
  RevealAttributeEnum.RACE,
]);
