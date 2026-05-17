/**
 * Every revealable slot on a PlayerCharacter. Five biology axes plus the nine
 * trait kinds. ACTION_CARD has multiple rows per character, so PlayerReveal
 * stores an optional `traitId` discriminator for those.
 */
export enum RevealAttributeEnum {
  AGE = 'AGE',
  WEIGHT = 'WEIGHT',
  SEX = 'SEX',
  GENDER = 'GENDER',
  RACE = 'RACE',
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
