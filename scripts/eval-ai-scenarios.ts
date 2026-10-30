// Eval scenarios for the local "Dóru AI" model gate (see eval-ai.test.ts).
// Each scenario drives the agent against a seeded tree through the real tool
// set (`doruTools` / `TreeMcpBackend`), then checks the expected tool calls
// and the final tree state. Prompts mix English and Russian on purpose: the
// shipped model must handle both.
import {
  OpQueue,
  addFamilyOp,
  addPersonOp,
  type FamilyRecord,
  type PersonRecord,
  type SqliteTreeRepository,
  type TreeRepository,
} from '@doru/core';

/** A tool call that must appear, in order, as a subsequence of the run. */
export interface ExpectedCall {
  name: string;
  /** Returns a failure message, or null when the arguments are as expected. */
  check?: (args: Record<string, unknown>) => string | null;
}

export interface EvalScenario {
  id: string;
  /** The user message that starts the conversation. */
  prompt: string;
  /** Which seed tree to use. Seeds match the prompt's language so that
   *  search results are real — the repository search does no transliteration,
   *  and a Latin query against a Cyrillic tree would push the model toward
   *  guessing ids instead of reading them from tool results. */
  seed: 'ru' | 'en';
  /** Expected tool calls (subsequence; extra calls are allowed). */
  mustCall: ExpectedCall[];
  /** Hard gate: assertions on the tree after the run. Returns failure messages. */
  checkState: (repo: TreeRepository) => string[];
  /** Soft metric: final text should contain at least one of these (case-insensitive). */
  mentions?: string[];
}

/** Seed trees: five persons, person @I1@ is the father of @I5@. */
interface Seed {
  persons: PersonRecord[];
  families: FamilyRecord[];
}

export const SEEDS: Record<'ru' | 'en', Seed> = {
  ru: {
    persons: [
      { id: '@I1@', names: [{ given: 'Иван', surname: 'Петров' }], sex: 'M' },
      { id: '@I2@', names: [{ given: 'Мария', surname: 'Сидорова' }], sex: 'F' },
      { id: '@I3@', names: [{ given: 'Анна', surname: 'Ковалёва' }], sex: 'F' },
      { id: '@I4@', names: [{ given: 'Борис', surname: 'Иванов' }], sex: 'M' },
      { id: '@I5@', names: [{ given: 'Пётр', surname: 'Петров' }], sex: 'M' },
    ],
    families: [{ id: '@F1@', parents: ['@I1@'], children: ['@I5@'] }],
  },
  en: {
    persons: [
      { id: '@I1@', names: [{ given: 'Ivan', surname: 'Petrov' }], sex: 'M' },
      { id: '@I2@', names: [{ given: 'Maria', surname: 'Sidorova' }], sex: 'F' },
      { id: '@I3@', names: [{ given: 'Anna', surname: 'Kovaleva' }], sex: 'F' },
      { id: '@I4@', names: [{ given: 'Boris', surname: 'Ivanov' }], sex: 'M' },
      { id: '@I5@', names: [{ given: 'Pyotr', surname: 'Petrov' }], sex: 'M' },
    ],
    families: [{ id: '@F1@', parents: ['@I1@'], children: ['@I5@'] }],
  },
};

export function seedFixture(queue: OpQueue, repo: SqliteTreeRepository, seed: 'ru' | 'en'): void {
  for (const person of SEEDS[seed].persons) {
    queue.apply(addPersonOp(person), { repo });
  }
  for (const family of SEEDS[seed].families) {
    queue.apply(addFamilyOp(family), { repo });
  }
}

// --- argument predicates ----------------------------------------------------

function queryHasAny(words: string[]): (args: Record<string, unknown>) => string | null {  return (args) => {
    const query = args['query'];
    if (typeof query !== 'string' || query.trim() === '') {
      return `tree_query called without a usable query (got ${JSON.stringify(query)})`;
    }
    const lowered = query.toLowerCase();
    return words.some((word) => lowered.includes(word.toLowerCase()))
      ? null
      : `tree_query query "${query}" does not mention any of: ${words.join(', ')}`;
  };
}

function querySex(sex: 'M' | 'F'): (args: Record<string, unknown>) => string | null {
  return (args) =>
    args['sex'] === sex ? null : `tree_query sex is ${JSON.stringify(args['sex'])}, expected "${sex}"`;
}

function personAdd(given: string, surname: string, sex: 'M' | 'F' | 'U'): (args: Record<string, unknown>) => string | null {
  return (args) => {
    const op = args['op'] as Record<string, unknown> | undefined;
    const person = op?.['person'] as Record<string, unknown> | undefined;
    const names = person?.['names'] as Array<Record<string, unknown>> | undefined;
    if (op?.['kind'] !== 'person.add') {
      return `tree_edit op kind is ${JSON.stringify(op?.['kind'])}, expected "person.add"`;
    }
    if (!names?.some((name) => name['given'] === given && name['surname'] === surname)) {
      return `tree_edit person names do not include ${given} ${surname}: ${JSON.stringify(names)}`;
    }
    return person?.['sex'] === sex ? null : `tree_edit person sex is ${JSON.stringify(person?.['sex'])}, expected "${sex}"`;
  };
}

function relative(relation: 'child' | 'spouse' | 'parent', anchorId: string, sex: 'M' | 'F' | 'U'): (args: Record<string, unknown>) => string | null {
  return (args) => {
    const person = args['person'] as Record<string, unknown> | undefined;
    if (args['relation'] !== relation) {
      return `tree_add_relative relation is ${JSON.stringify(args['relation'])}, expected "${relation}"`;
    }
    if (args['anchorId'] !== anchorId) {
      return `tree_add_relative anchorId is ${JSON.stringify(args['anchorId'])}, expected "${anchorId}"`;
    }
    return person?.['sex'] === sex
      ? null
      : `tree_add_relative person sex is ${JSON.stringify(person?.['sex'])}, expected "${sex}"`;
  };
}

function sourceTitle(titlePart: string, targetId: string): (args: Record<string, unknown>) => string | null {
  return (args) => {
    const title = args['title'];
    if (typeof title !== 'string' || !title.toLowerCase().includes(titlePart.toLowerCase())) {
      return `sources_add title ${JSON.stringify(title)} does not include "${titlePart}"`;
    }
    return args['targetId'] === targetId
      ? null
      : `sources_add targetId is ${JSON.stringify(args['targetId'])}, expected "${targetId}"`;
  };
}

function noteText(textPart: string, targetId: string): (args: Record<string, unknown>) => string | null {
  return (args) => {
    const text = args['text'];
    if (typeof text !== 'string' || !text.toLowerCase().includes(textPart.toLowerCase())) {
      return `notes_write text ${JSON.stringify(text)} does not include "${textPart}"`;
    }
    return args['targetId'] === targetId
      ? null
      : `notes_write targetId is ${JSON.stringify(args['targetId'])}, expected "${targetId}"`;
  };
}

// --- state predicates ---------------------------------------------------------

/**
 * Finds a person whose given name contains one of `givenAlts` and whose
 * surname contains one of `surnameAlts` (lowercase substring match; an empty
 * alternative matches anything). Russian and English spellings can both be
 * listed, since the model is free to pick either.
 */
function personNamed(repo: TreeRepository, givenAlts: string[], surnameAlts: string[] = ['']): PersonRecord | undefined {
  return repo.listAllPersons().find((person) =>
    person.names.some((name) => {
      const given = (name.given ?? '').toLowerCase();
      const surname = (name.surname ?? '').toLowerCase();
      return (
        givenAlts.some((alt) => given.includes(alt.toLowerCase())) &&
        surnameAlts.some((alt) => surname.includes(alt.toLowerCase()))
      );
    }),
  );
}

function findPersonId(repo: TreeRepository, givenAlts: string[], surnameAlts: string[] = ['']): string | undefined {
  return personNamed(repo, givenAlts, surnameAlts)?.id;
}

/** A family where `parentId` is a parent and a person matching the patterns is a child. */
function familyWithChild(repo: TreeRepository, parentId: string, childGivenAlts: string[]): boolean {
  const childId = findPersonId(repo, childGivenAlts);
  if (childId === undefined) {
    return false;
  }
  return repo.listFamilies().some((family) => family.parents.includes(parentId) && family.children.includes(childId));
}

/** A family where `anchorId` and a person matching the patterns are both parents (spouse link). */
function familyWithSpouse(repo: TreeRepository, anchorId: string, spouseGivenAlts: string[]): boolean {
  const spouseId = findPersonId(repo, spouseGivenAlts);
  if (spouseId === undefined) {
    return false;
  }
  return repo.listFamilies().some((family) => family.parents.includes(anchorId) && family.parents.includes(spouseId));
}

// --- scenarios -----------------------------------------------------------------

export const EVAL_SCENARIOS: EvalScenario[] = [
  {
    id: 'stats_en',
    prompt: 'How many people are stored in this family tree?',
    seed: 'en',
    mustCall: [{ name: 'tree_stats' }],
    checkState: () => [],
    mentions: ['5', 'five'],
  },
  {
    id: 'query_ivan_ru',
    prompt: 'Найди в дереве Ивана Петрова.',
    seed: 'ru',
    mustCall: [{ name: 'tree_query', check: queryHasAny(['иван', 'петров']) }],
    checkState: () => [],
    mentions: ['иван'],
  },
  {
    id: 'query_men_en',
    prompt: 'List all the men in the tree.',
    seed: 'en',
    mustCall: [{ name: 'tree_query', check: querySex('M') }],
    checkState: () => [],
    mentions: ['иван', 'борис', 'пётр', 'ivan', 'boris'],
  },
  {
    id: 'add_elena_ru',
    prompt: 'Добавь в дерево Елену Смирнову, женщину.',
    seed: 'ru',
    mustCall: [{ name: 'tree_edit', check: personAdd('Елена', 'Смирнова', 'F') }],
    checkState: (repo) =>
      personNamed(repo, ['елена'], ['смирнова'])?.sex === 'F'
        ? []
        : ['a person named Елена Смирнова (F) was not added to the tree'],
    mentions: ['елена'],
  },
  {
    id: 'add_wife_en',
    prompt: "Vera Volkova is Ivan Petrov's wife. Add her to the tree as his spouse.",
    seed: 'en',
    mustCall: [
      { name: 'tree_query', check: queryHasAny(['иван', 'петров', 'ivan']) },
      { name: 'tree_add_relative', check: relative('spouse', '@I1@', 'F') },
    ],
    checkState: (repo) =>
      familyWithSpouse(repo, '@I1@', ['вера', 'vera'])
        ? []
        : ['no family links Ivan Petrov (@I1@) to his wife Vera Volkova'],
    mentions: ['вера', 'vera'],
  },
  {
    id: 'add_son_ru',
    prompt: 'У Ивана Петрова родился сын Алексей. Добавь его в дерево.',
    seed: 'ru',
    mustCall: [
      { name: 'tree_query', check: queryHasAny(['иван', 'петров']) },
      { name: 'tree_add_relative', check: relative('child', '@I1@', 'M') },
    ],
    checkState: (repo) =>
      familyWithChild(repo, '@I1@', ['алексей', 'alexey'])
        ? []
        : ['no family links Ivan Petrov (@I1@) to his son Alexey'],
    mentions: ['алексей', 'alexey'],
  },
  {
    id: 'add_father_en',
    prompt: 'Add Dmitry Petrov as the father of Boris Ivanov.',
    seed: 'en',
    mustCall: [
      { name: 'tree_query', check: queryHasAny(['борис', 'boris']) },
      { name: 'tree_add_relative', check: relative('parent', '@I4@', 'M') },
    ],
    checkState: (repo) => {
      const dmitryId = findPersonId(repo, ['дмитрий', 'dmitry']);
      if (dmitryId === undefined) {
        return ['a person named Dmitry Petrov was not added'];
      }
      return repo
        .listFamilies()
        .some((family) => family.parents.includes(dmitryId) && family.children.includes('@I4@'))
        ? []
        : ['no family links Dmitry Petrov as the parent of Boris Ivanov (@I4@)'];
    },
    mentions: ['дмитрий', 'dmitry'],
  },
  {
    id: 'source_1897_en',
    prompt: 'Add a source titled "1897 census" and attach it to Ivan Petrov.',
    seed: 'en',
    mustCall: [
      { name: 'tree_query', check: queryHasAny(['иван', 'petrov', 'петров']) },
      { name: 'sources_add', check: sourceTitle('1897', '@I1@') },
    ],
    checkState: (repo) => {
      const failures: string[] = [];
      if (!repo.listSources().some((source) => source.title.toLowerCase().includes('1897'))) {
        failures.push('no source with "1897" in the title was added');
      }
      if (repo.listCitationsFor('person', '@I1@').length === 0) {
        failures.push('the source is not cited on Ivan Petrov (@I1@)');
      }
      return failures;
    },
    mentions: ['1897', 'census'],
  },
  {
    id: 'note_ivan_ru',
    prompt: 'Запиши заметку про Ивана Петрова: проверить дату рождения.',
    seed: 'ru',
    mustCall: [
      { name: 'tree_query', check: queryHasAny(['иван', 'петров']) },
      { name: 'notes_write', check: noteText('рождения', '@I1@') },
    ],
    checkState: (repo) =>
      repo.listNotes().some((note) => note.text.toLowerCase().includes('рождения'))
        ? []
        : ['no note mentioning "рождения" was written'],
    mentions: ['заметк', 'готово', 'записа'],
  },
  {
    id: 'multi_son_ru',
    prompt: 'Найди Ивана Петрова и добавь его сына Николая.',
    seed: 'ru',
    mustCall: [
      { name: 'tree_query', check: queryHasAny(['иван', 'петров']) },
      { name: 'tree_add_relative', check: relative('child', '@I1@', 'M') },
    ],
    checkState: (repo) =>
      familyWithChild(repo, '@I1@', ['николай', 'nikolay'])
        ? []
        : ['no family links Ivan Petrov (@I1@) to his son Nikolay'],
    mentions: ['николай', 'nikolay'],
  },
  {
    id: 'not_found_en',
    prompt: 'What do you know about Zelda Nobody in this tree?',
    seed: 'en',
    mustCall: [{ name: 'tree_query' }],
    checkState: (repo) =>
      repo.countPersons() === SEEDS.en.persons.length ? [] : ['the tree changed, but this scenario is read-only'],
    mentions: ['not found', 'no one', 'no person', 'nothing', 'нет так'],
  },
];
