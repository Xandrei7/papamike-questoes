import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import type { UserAnswer, SubjectProgress } from '@/types'

interface StudyContextType {
  answers: UserAnswer[]
  favorites: string[]
  recordAnswer: (answer: UserAnswer) => void
  resetByQuestionIds: (ids: string[]) => void
  resetAllProgress: () => void
  toggleFavorite: (questionId: string) => void
  isFavorite: (questionId: string) => boolean
  getSubjectProgress: (subjectId: string, questionIds: string[]) => SubjectProgress
  getWrongAnswers: () => UserAnswer[]
  clearAnswer: (questionId: string) => void
}

const StudyContext = createContext<StudyContextType | null>(null)

const ANSWERS_KEY = 'study-answers'
const FAVORITES_KEY = 'study-favorites'

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function StudyProvider({ children }: { children: ReactNode }) {
  const [answers, setAnswers] = useState<UserAnswer[]>(() => loadFromStorage(ANSWERS_KEY, []))
  const [favorites, setFavorites] = useState<string[]>(() => loadFromStorage(FAVORITES_KEY, []))

  useEffect(() => { localStorage.setItem(ANSWERS_KEY, JSON.stringify(answers)) }, [answers])
  useEffect(() => { localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites)) }, [favorites])

  function recordAnswer(answer: UserAnswer) {
    setAnswers(prev => {
      const existing = prev.findIndex(a => a.questionId === answer.questionId)
      if (existing >= 0) {
        const updated = [...prev]
        updated[existing] = answer
        return updated
      }
      return [...prev, answer]
    })
  }

  function resetByQuestionIds(ids: string[]) {
    setAnswers(prev => prev.filter(a => !ids.includes(a.questionId)))
  }

  function resetAllProgress() {
    setAnswers([])
  }

  function toggleFavorite(questionId: string) {
    setFavorites(prev =>
      prev.includes(questionId)
        ? prev.filter(id => id !== questionId)
        : [...prev, questionId]
    )
  }

  function isFavorite(questionId: string) {
    return favorites.includes(questionId)
  }

  function getSubjectProgress(subjectId: string, questionIds: string[]): SubjectProgress {
    const subjectAnswers = answers.filter(a => questionIds.includes(a.questionId))
    return {
      subjectId,
      total: questionIds.length,
      answered: subjectAnswers.length,
      correct: subjectAnswers.filter(a => a.isCorrect).length,
    }
  }

  function getWrongAnswers(): UserAnswer[] {
    return answers.filter(a => !a.isCorrect)
  }

  function clearAnswer(questionId: string) {
    setAnswers(prev => prev.filter(a => a.questionId !== questionId))
  }

  return (
    <StudyContext.Provider value={{
      answers,
      favorites,
      recordAnswer,
      resetByQuestionIds,
      resetAllProgress,
      toggleFavorite,
      isFavorite,
      getSubjectProgress,
      getWrongAnswers,
      clearAnswer,
    }}>
      {children}
    </StudyContext.Provider>
  )
}

export function useStudy() {
  const ctx = useContext(StudyContext)
  if (!ctx) throw new Error('useStudy must be used inside StudyProvider')
  return ctx
}

