export interface ParsedOption {
  letter: string
  text: string
}

export interface ParsedQuestion {
  number: number
  statement: string
  type: 'multiple_choice' | 'true_false'
  options: ParsedOption[] | null
  correctAnswer: string
  comment: string
}

export function parseQuestionsText(rawText: string): ParsedQuestion[] {
  const gabaritoRegex = /GABARITO\s*COMENTADO/i
  const splitIndex = rawText.search(gabaritoRegex)

  if (splitIndex === -1) {
    return parseQuestionsSection(rawText).map(q => ({ ...q, correctAnswer: '', comment: '' }))
  }

  const questionsText = rawText.slice(0, splitIndex)
  const gabaritoText = rawText.slice(splitIndex)

  const questionMap = parseQuestionsSection(questionsText)
  const answerMap = parseGabaritoSection(gabaritoText)

  return questionMap
    .sort((a, b) => a.number - b.number)
    .map(q => ({
      ...q,
      correctAnswer: answerMap[q.number]?.letter ?? '',
      comment: answerMap[q.number]?.comment ?? '',
    }))
}

function parseQuestionsSection(text: string) {
  // Match lines that are just a number with . or ) — e.g. "1." or "1)" or "1. "
  const questionStartRegex = /^[ \t]*(\d+)[.)]\s*$/gm
  const matches = [...text.matchAll(questionStartRegex)]

  const results: Omit<ParsedQuestion, 'correctAnswer' | 'comment'>[] = []

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]
    const nextMatch = matches[i + 1]
    const number = parseInt(match[1])

    const blockStart = (match.index ?? 0) + match[0].length
    const blockEnd = nextMatch?.index ?? text.length
    const blockText = text.slice(blockStart, blockEnd)

    const { statement, options } = parseQuestionBlock(blockText)

    const isTrueFalse =
      options.length === 0 ||
      (options.length === 2 && options.every(o => ['C', 'E'].includes(o.letter)))

    results.push({
      number,
      statement,
      type: isTrueFalse ? 'true_false' : 'multiple_choice',
      options: isTrueFalse ? null : options,
    })
  }

  return results
}

function parseQuestionBlock(text: string) {
  const lines = text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0)

  // Option lines: start with a single letter followed by )
  const optionPattern = /^([a-eA-E])\)\s*(.+)/

  const firstOptIdx = lines.findIndex(l => optionPattern.test(l))

  const statementLines = firstOptIdx >= 0 ? lines.slice(0, firstOptIdx) : lines
  const optionLines = firstOptIdx >= 0 ? lines.slice(firstOptIdx) : []

  const options: ParsedOption[] = optionLines
    .map(line => {
      const m = line.match(optionPattern)
      return m ? { letter: m[1].toUpperCase(), text: m[2].trim() } : null
    })
    .filter(Boolean) as ParsedOption[]

  return {
    statement: statementLines.join(' ').replace(/\s+/g, ' ').trim(),
    options,
  }
}

function parseGabaritoSection(text: string): Record<number, { letter: string; comment: string }> {
  // Match lines like "1. C" or "1) C"
  const answerLineRegex = /^[ \t]*(\d+)[.)]\s+([A-Ea-e])\s*$/gm
  const matches = [...text.matchAll(answerLineRegex)]

  const map: Record<number, { letter: string; comment: string }> = {}

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]
    const nextMatch = matches[i + 1]

    const number = parseInt(match[1])
    const letter = match[2].toUpperCase()

    const commentStart = (match.index ?? 0) + match[0].length
    const commentEnd = nextMatch?.index ?? text.length
    const comment = text
      .slice(commentStart, commentEnd)
      .replace(/^\s+/, '')
      .replace(/\s+$/, '')

    map[number] = { letter, comment }
  }

  return map
}
