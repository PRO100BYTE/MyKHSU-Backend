const PROFANITY_WORDS = [
  // English
  'fuck',
  'fucking',
  'motherfucker',
  'shit',
  'bitch',
  'asshole',
  'bastard',
  'dick',
  'cunt',
  'whore',
  // Russian
  'хуй',
  'хер',
  'хуйня',
  'хуево',
  'пизда',
  'пиздец',
  'ебать',
  'ебан',
  'ебуч',
  'блядь',
  'блять',
  'сука',
  'мудак',
  'долбоеб',
  'говно',
  'мразь',
]

const LETTERS_PATTERN = 'A-Za-zА-Яа-яЁё'

function normalize(value) {
  return String(value ?? '').toLowerCase().replace(/ё/g, 'е')
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const WORD_PATTERNS = PROFANITY_WORDS.map((word) => {
  const normalizedWord = normalize(word)
  return {
    word: normalizedWord,
    regex: new RegExp(`(^|[^${LETTERS_PATTERN}])${escapeRegex(normalizedWord)}(?=$|[^${LETTERS_PATTERN}])`, 'i'),
  }
})

export function findProfanity(text) {
  const normalizedText = normalize(text)
  const matches = []

  for (const item of WORD_PATTERNS) {
    if (item.regex.test(normalizedText)) {
      matches.push(item.word)
    }
  }

  return {
    hasProfanity: matches.length > 0,
    matches,
  }
}

export { PROFANITY_WORDS }
