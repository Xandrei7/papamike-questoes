import { useEffect, useState } from 'react'
import { Heart } from 'lucide-react'
import { Header } from '@/components/Header'
import { BottomNav } from '@/components/BottomNav'
import { QuestionCard } from '@/components/QuestionCard'
import { getQuestions } from '@/lib/dataService'
import { useStudy } from '@/contexts/StudyContext'
import type { Question, UserAnswer } from '@/types'

export function Favorites() {
  const { favorites, answers, recordAnswer } = useStudy()
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const all = await getQuestions()
      setQuestions(all.filter(q => favorites.includes(q.id)))
      setLoading(false)
    }
    load()
  }, [favorites])

  const currentQuestion = questions[currentIndex]

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header title="Favoritos" subtitle={`${questions.length} questões salvas`} />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-4 pb-24">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : questions.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Heart size={48} className="text-muted-foreground/40" />
            <p className="font-medium">Nenhum favorito ainda</p>
            <p className="text-sm text-muted-foreground">Toque no coração em qualquer questão para salvá-la aqui.</p>
          </div>
        ) : currentQuestion ? (
          <QuestionCard
            question={currentQuestion}
            questionNumber={currentIndex + 1}
            totalQuestions={questions.length}
            existingAnswer={answers.find(a => a.questionId === currentQuestion.id)}
            onAnswer={(answer: UserAnswer) => recordAnswer(answer)}
            onNext={() => setCurrentIndex(i => Math.min(questions.length - 1, i + 1))}
            onPrev={() => setCurrentIndex(i => Math.max(0, i - 1))}
            onSkip={() => setCurrentIndex(i => Math.min(questions.length - 1, i + 1))}
            isFirst={currentIndex === 0}
            isLast={currentIndex === questions.length - 1}
          />
        ) : null}
      </main>
      <BottomNav />
    </div>
  )
}
