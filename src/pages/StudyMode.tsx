import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Shuffle, List, RotateCcw } from 'lucide-react'
import { Header } from '@/components/Header'
import { QuestionCard } from '@/components/QuestionCard'
import { getSubjects, getDisciplines, getQuestions } from '@/lib/dataService'
import { useStudy } from '@/contexts/StudyContext'
import { shuffle } from '@/lib/utils'
import type { Question, UserAnswer } from '@/types'

type Mode = 'discipline' | 'subject'

export function StudyMode() {
  const { subjectId, disciplineId } = useParams<{ subjectId?: string; disciplineId?: string }>()
  const mode: Mode = disciplineId ? 'discipline' : 'subject'
  const navigate = useNavigate()
  const { answers, recordAnswer } = useStudy()

  const [title, setTitle] = useState('')
  const [allQuestions, setAllQuestions] = useState<Question[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [studyStarted, setStudyStarted] = useState(false)

  useEffect(() => {
    async function load() {
      if (mode === 'subject' && subjectId) {
        const [subjects, disciplines, qs] = await Promise.all([
          getSubjects(),
          getDisciplines(),
          getQuestions({ subjectId }),
        ])
        const subject = subjects.find(s => s.id === subjectId)
        const discipline = disciplines.find(d => d.id === subject?.discipline_id)
        setTitle(`${discipline?.name ?? ''} › ${subject?.name ?? ''}`)
        setAllQuestions(qs)
      } else if (mode === 'discipline' && disciplineId) {
        const [disciplines, qs] = await Promise.all([
          getDisciplines(),
          getQuestions({ disciplineId }),
        ])
        const discipline = disciplines.find(d => d.id === disciplineId)
        setTitle(discipline?.name ?? '')
        setAllQuestions(qs)
      }
      setLoading(false)
    }
    load()
  }, [subjectId, disciplineId, mode])

  const answeredIds = new Set(answers.map(a => a.questionId))
  const answeredCount = allQuestions.filter(q => answeredIds.has(q.id)).length
  const hasProgress = answeredCount > 0

  function startStudy(selectedMode: 'sequential' | 'random', fromStart = false) {
    let qs = [...allQuestions]
    if (selectedMode === 'random') {
      qs = shuffle(qs)
    }
    setQuestions(qs)

    if (!fromStart && selectedMode === 'sequential') {
      const firstUnanswered = qs.findIndex(q => !answeredIds.has(q.id))
      setCurrentIndex(firstUnanswered >= 0 ? firstUnanswered : 0)
    } else {
      setCurrentIndex(0)
    }
    setStudyStarted(true)
  }

  function resetAndStart(selectedMode: 'sequential' | 'random') {
    startStudy(selectedMode, true)
  }

  const handleAnswer = useCallback((answer: UserAnswer) => {
    recordAnswer(answer)
  }, [recordAnswer])

  function handleNext() {
    if (currentIndex === questions.length - 1) {
      if (mode === 'subject' && subjectId) {
        navigate(`/study/${subjectId}/complete`)
      } else {
        navigate('/')
      }
    } else {
      setCurrentIndex(i => i + 1)
    }
  }

  function handlePrev() {
    setCurrentIndex(i => Math.max(0, i - 1))
  }

  function handleSkip() {
    setCurrentIndex(i => Math.min(questions.length - 1, i + 1))
  }

  const currentQuestion = questions[currentIndex]

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!studyStarted) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header title={title} showBack />
        <main className="mx-auto w-full max-w-lg flex-1 px-4 py-6">
          <h2 className="text-lg font-bold mb-1">Como deseja estudar?</h2>
          <p className="text-sm text-muted-foreground mb-6">
            {allQuestions.length} questões disponíveis
            {hasProgress && ` · ${answeredCount} já respondidas`}
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => startStudy('sequential')}
              className="flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-4 text-left hover:border-primary hover:bg-primary/5 transition-all"
            >
              <List size={22} className="text-primary" />
              <div>
                <p className="font-medium">Ordem sequencial</p>
                <p className="text-sm text-muted-foreground">
                  {hasProgress ? 'Continuar de onde parou' : 'Começar do início'}
                </p>
              </div>
            </button>
            <button
              onClick={() => startStudy('random')}
              className="flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-4 text-left hover:border-primary hover:bg-primary/5 transition-all"
            >
              <Shuffle size={22} className="text-primary" />
              <div>
                <p className="font-medium">Ordem aleatória</p>
                <p className="text-sm text-muted-foreground">Questões embaralhadas</p>
              </div>
            </button>
            {hasProgress && (
              <button
                onClick={() => resetAndStart('sequential')}
                className="flex items-center gap-4 rounded-xl border border-dashed border-border px-4 py-4 text-left hover:border-primary transition-all"
              >
                <RotateCcw size={22} className="text-muted-foreground" />
                <div>
                  <p className="font-medium text-muted-foreground">Começar do início</p>
                  <p className="text-sm text-muted-foreground">Resetar progresso e reiniciar</p>
                </div>
              </button>
            )}
          </div>
        </main>
      </div>
    )
  }

  if (!currentQuestion) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Nenhuma questão encontrada.</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header title={title} showBack />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-4 pb-8">
        <QuestionCard
          question={currentQuestion}
          questionNumber={currentIndex + 1}
          totalQuestions={questions.length}
          existingAnswer={answers.find(a => a.questionId === currentQuestion.id)}
          onAnswer={handleAnswer}
          onNext={handleNext}
          onPrev={handlePrev}
          onSkip={handleSkip}
          isFirst={currentIndex === 0}
          isLast={currentIndex === questions.length - 1}
        />
      </main>
    </div>
  )
}
