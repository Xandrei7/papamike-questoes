import { useEffect, useState } from 'react'
import { Header } from '@/components/Header'
import { BottomNav } from '@/components/BottomNav'
import { ProgressBar } from '@/components/ProgressBar'
import { getDisciplines, getQuestions } from '@/lib/dataService'
import { useStudy } from '@/contexts/StudyContext'
import { cn, formatPercent } from '@/lib/utils'
import type { Discipline, Question } from '@/types'

interface DisciplineStat {
  discipline: Discipline
  questions: Question[]
}

export function Stats() {
  const { answers } = useStudy()
  const [stats, setStats] = useState<DisciplineStat[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [disciplines, questions] = await Promise.all([getDisciplines(), getQuestions()])
      setStats(disciplines.map(d => ({
        discipline: d,
        questions: questions.filter(q => q.discipline_id === d.id),
      })))
      setLoading(false)
    }
    load()
  }, [])

  const allQuestionIds = stats.flatMap(s => s.questions.map(q => q.id))
  const totalQuestions = allQuestionIds.length
  const answered = answers.filter(a => allQuestionIds.includes(a.questionId)).length
  const correct = answers.filter(a => allQuestionIds.includes(a.questionId) && a.isCorrect).length
  const wrong = answered - correct
  const percent = answered === 0 ? 0 : Math.round((correct / answered) * 100)

  function getDisciplineAccuracy(qs: Question[]) {
    const ids = qs.map(q => q.id)
    const ans = answers.filter(a => ids.includes(a.questionId))
    if (ans.length === 0) return null
    return Math.round((ans.filter(a => a.isCorrect).length / ans.length) * 100)
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header title="Estatísticas" subtitle="Seu desempenho geral" />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-4 pb-24">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : answered === 0 ? (
          <p className="py-12 text-center text-muted-foreground">Comece a responder questões para ver suas estatísticas.</p>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Overall */}
            <div className="flex flex-col gap-3">
              <div className="rounded-xl border border-border bg-card p-4 col-span-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Aproveitamento geral</span>
                  <span className="text-2xl font-bold text-primary">{percent}%</span>
                </div>
                <ProgressBar value={correct} max={answered} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-2xl font-bold text-green-500">{correct}</p>
                  <p className="text-sm text-muted-foreground">Acertos</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-2xl font-bold text-red-500">{wrong}</p>
                  <p className="text-sm text-muted-foreground">Erros</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-2xl font-bold text-primary">{answered}</p>
                  <p className="text-sm text-muted-foreground">Respondidas</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-2xl font-bold text-red-500">{wrong}</p>
                  <p className="text-sm text-muted-foreground">Para revisar</p>
                </div>
              </div>
            </div>

            {/* Progress total */}
            <div>
              <h2 className="font-semibold mb-2">Progresso total</h2>
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex justify-between text-sm mb-2">
                  <span>{answered} de {totalQuestions} questões</span>
                  <span className="text-muted-foreground">{formatPercent(answered, totalQuestions)}</span>
                </div>
                <ProgressBar value={answered} max={totalQuestions} />
              </div>
            </div>

            {/* Per discipline */}
            <div>
              <h2 className="font-semibold mb-2">Por matéria</h2>
              <div className="flex flex-col gap-2">
                {stats.map(({ discipline, questions }) => {
                  const acc = getDisciplineAccuracy(questions)
                  const disciplineAnswered = answers.filter(a => questions.map(q => q.id).includes(a.questionId)).length
                  if (acc === null) return null
                  return (
                    <div key={discipline.id} className="rounded-xl border border-border bg-card p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span>{discipline.icon}</span>
                        <span className="font-medium flex-1">{discipline.name}</span>
                        <span className={cn(
                          'font-bold text-sm',
                          acc >= 70 ? 'text-green-500' : acc >= 50 ? 'text-amber-500' : 'text-red-500'
                        )}>
                          {acc}%
                        </span>
                      </div>
                      <ProgressBar value={disciplineAnswered} max={questions.length} showLabel />
                    </div>
                  )
                })}
              </div>
            </div>

            <p className="text-center text-sm text-muted-foreground">Continue estudando para manter esse resultado.</p>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
