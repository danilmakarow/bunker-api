/* eslint-disable */
const fs = require('fs');

const data = JSON.parse(fs.readFileSync('/tmp/bunker_cards.json', 'utf8'));

const polarityMap = {
  Добре: 'POSITIVE',
  Нейтральне: 'NEUTRAL',
  Погане: 'NEGATIVE',
};

const traitSheets = {
  Професії: 'PROFESSION',
  'Здоров’я': 'HEALTH',
  Хобі: 'HOBBY',
  Фобії: 'PHOBIA',
  'Риси характеру': 'CHARACTER_TRAIT',
  Багаж: 'LUGGAGE',
  'Особливий факт': 'PERSONAL_FACT',
  Дії: 'ACTION_CARD',
};

const biologySheets = {
  Вага: 'biology_weight',
  Вік: 'biology_age',
  Стать: 'biology_sex',
  Орієнтація: 'biology_gender',
  Раса: 'biology_race',
};

const rowsAfterHeader = (sheetName) => {
  const sheet = data[sheetName];
  if (!sheet) throw new Error(`Sheet not found: ${sheetName}`);
  return sheet.filter((row) => row.rowNum > 1 && row.cells && row.cells.length);
};

// Aggregate
const traits = [];
for (const [sheetName, kind] of Object.entries(traitSheets)) {
  for (const row of rowsAfterHeader(sheetName)) {
    const [, title, rating] = row.cells;
    if (!title) continue;
    const polarity = polarityMap[rating];
    if (!polarity) {
      throw new Error(`Unknown polarity '${rating}' in ${sheetName} row ${row.rowNum}`);
    }
    traits.push({ kind, polarity, titleUk: title });
  }
}

const biology = {};
for (const [sheetName, table] of Object.entries(biologySheets)) {
  biology[table] = rowsAfterHeader(sheetName)
    .map((row) => row.cells[1])
    .filter((value) => value && value.length);
}

// Shelters: row.cells = [№, площа, локація, тривалість, обладнання, запаси, оцінка]
const shelters = rowsAfterHeader('Умови бункеру').map((row) => {
  const [, area, location, duration, equipment, supplies, rating] = row.cells;
  return {
    areaUk: area,
    locationUk: location,
    durationUk: duration,
    equipmentUk: equipment,
    suppliesUk: supplies,
    polarity: polarityMap[rating] ?? 'NEUTRAL',
  };
});

// Apocalypses: row.cells = [№, назва, опис, залишок, оцінка]
const apocalypses = rowsAfterHeader('Вид апокаліпсису').map((row) => {
  const [, name, description, remainder, rating] = row.cells;
  return {
    nameUk: name,
    descriptionUk: description,
    populationRemainderUk: remainder,
    polarity: polarityMap[rating] ?? 'NEUTRAL',
  };
});

console.error(
  `traits=${traits.length} apoc=${apocalypses.length} shelter=${shelters.length} biology=${Object.entries(
    biology,
  )
    .map(([t, list]) => `${t}=${list.length}`)
    .join(' ')}`,
);

// Emit migration
const indent = '      ';
const stringifyArray = (items, mapper) =>
  items
    .map((item) => `${indent}${JSON.stringify(mapper(item))},`)
    .join('\n');

const banner = `/**
 * M4 — seeds game content from \`bunker_cards_ua_v7.xlsx\`. Idempotent within
 * one run; will fail if executed twice without first emptying the tables
 * (re-applying this migration is not the intended way to refresh content —
 * write a new migration that UPSERTs by stable text).
 *
 * Counts at seed time:
 *   traits        ${traits.length}
 *   apocalypses   ${apocalypses.length}
 *   shelters      ${shelters.length}
 *   biology_age   ${biology.biology_age.length}
 *   biology_weight ${biology.biology_weight.length}
 *   biology_sex    ${biology.biology_sex.length}
 *   biology_gender ${biology.biology_gender.length}
 *   biology_race   ${biology.biology_race.length}
 */`;

const className = 'GameSeed1779126000000';
const timestamp = 1779126000000;

const content = `import { MigrationInterface, QueryRunner } from 'typeorm';

${banner}
export class ${className} implements MigrationInterface {
  name = '${className}';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.seedTraits(queryRunner);
    await this.seedBiology(queryRunner, 'biology_age', BIOLOGY_AGE);
    await this.seedBiology(queryRunner, 'biology_weight', BIOLOGY_WEIGHT);
    await this.seedBiology(queryRunner, 'biology_sex', BIOLOGY_SEX);
    await this.seedBiology(queryRunner, 'biology_gender', BIOLOGY_GENDER);
    await this.seedBiology(queryRunner, 'biology_race', BIOLOGY_RACE);
    await this.seedShelters(queryRunner);
    await this.seedApocalypses(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(\`DELETE FROM "apocalypse"\`);
    await queryRunner.query(\`DELETE FROM "shelter"\`);
    await queryRunner.query(\`DELETE FROM "biology_race"\`);
    await queryRunner.query(\`DELETE FROM "biology_gender"\`);
    await queryRunner.query(\`DELETE FROM "biology_sex"\`);
    await queryRunner.query(\`DELETE FROM "biology_weight"\`);
    await queryRunner.query(\`DELETE FROM "biology_age"\`);
    await queryRunner.query(\`DELETE FROM "trait"\`);
  }

  private async seedTraits(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      \`INSERT INTO "trait" ("kind", "polarity", "titleUk")
       SELECT *
       FROM unnest($1::"public"."trait_kind_enum"[],
                   $2::"public"."polarity_enum"[],
                   $3::text[])\`,
      [
        TRAITS.map((trait) => trait.kind),
        TRAITS.map((trait) => trait.polarity),
        TRAITS.map((trait) => trait.titleUk),
      ],
    );
  }

  private async seedBiology(
    queryRunner: QueryRunner,
    table: string,
    values: string[],
  ): Promise<void> {
    await queryRunner.query(
      \`INSERT INTO "\${table}" ("valueUk") SELECT * FROM unnest($1::text[])\`,
      [values],
    );
  }

  private async seedShelters(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      \`INSERT INTO "shelter"
        ("areaUk", "locationUk", "durationUk", "equipmentUk", "suppliesUk", "polarity")
       SELECT *
       FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[],
                   $6::"public"."polarity_enum"[])\`,
      [
        SHELTERS.map((shelter) => shelter.areaUk),
        SHELTERS.map((shelter) => shelter.locationUk),
        SHELTERS.map((shelter) => shelter.durationUk),
        SHELTERS.map((shelter) => shelter.equipmentUk),
        SHELTERS.map((shelter) => shelter.suppliesUk),
        SHELTERS.map((shelter) => shelter.polarity),
      ],
    );
  }

  private async seedApocalypses(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      \`INSERT INTO "apocalypse"
        ("nameUk", "descriptionUk", "populationRemainderUk", "polarity")
       SELECT *
       FROM unnest($1::text[], $2::text[], $3::text[],
                   $4::"public"."polarity_enum"[])\`,
      [
        APOCALYPSES.map((row) => row.nameUk),
        APOCALYPSES.map((row) => row.descriptionUk),
        APOCALYPSES.map((row) => row.populationRemainderUk),
        APOCALYPSES.map((row) => row.polarity),
      ],
    );
  }
}

const TRAITS: { kind: string; polarity: string; titleUk: string }[] = [
${stringifyArray(traits, (trait) => trait)}
];

const BIOLOGY_AGE: string[] = [
${stringifyArray(biology.biology_age, (value) => value)}
];

const BIOLOGY_WEIGHT: string[] = [
${stringifyArray(biology.biology_weight, (value) => value)}
];

const BIOLOGY_SEX: string[] = [
${stringifyArray(biology.biology_sex, (value) => value)}
];

const BIOLOGY_GENDER: string[] = [
${stringifyArray(biology.biology_gender, (value) => value)}
];

const BIOLOGY_RACE: string[] = [
${stringifyArray(biology.biology_race, (value) => value)}
];

const SHELTERS: {
  areaUk: string;
  locationUk: string;
  durationUk: string;
  equipmentUk: string;
  suppliesUk: string;
  polarity: string;
}[] = [
${stringifyArray(shelters, (shelter) => shelter)}
];

const APOCALYPSES: {
  nameUk: string;
  descriptionUk: string;
  populationRemainderUk: string;
  polarity: string;
}[] = [
${stringifyArray(apocalypses, (apocalypse) => apocalypse)}
];
`;

fs.writeFileSync(
  `/Users/danil/personal-projects/bunker-api/src/migrations/${timestamp}-game-seed.ts`,
  content,
);
console.error('wrote migration file');
