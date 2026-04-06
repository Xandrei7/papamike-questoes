import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, CheckCircle2, ChevronRight } from 'lucide-react'
import { Header } from '@/components/Header'
import { BottomNav } from '@/components/BottomNav'
import { ProgressBar } from '@/components/ProgressBar'
import { getDisciplines, getSubjects, getQuestions } from '@/lib/dataService'
import { useStudy } from '@/contexts/StudyContext'
import { shuffle, cn } from '@/lib/utils'
import type { Discipline, Subject, Question } from '@/types'

type Phase = 'setup' | 'running' | 'result'

interface SimAnswer {
  questionId: string
  selected: string | null
  isCorrect: boolean
  disciplineId: string
}

export function Simulado() {
  const navigate = useNavigate()
  const { recordAnswer } = useStudy()

  const [phase, setPhase] = useState<Phase>('setup')
  const [disciplines, setDisciplines] = useState<Discipline[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [allQuestions, setAllQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)

  // Setup
  const [selectedDisciplines, setSelectedDisciplines] = useState<Set<string>>(new Set())
  const [questionCount, setQuestionCount] = useState(20)
  const [timeMinutes, setTimeMinutes] = useState(30)

  // Running
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [simAnswers, setSimAnswers] = useState<SimAnswer[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const simAnswersRef = useRef<SimAnswer[]>([])
  simAnswersRef.current = simAnswers
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const finishedRef = useRef(false)

  useEffect(() => {
    async function load() {
      const [discs, subs, qs] = await Promise.all([getDisciplines(), getSubjects(), getQuestions()])
      setDisciplines(discs)
      setSubjects(subs)
      setAllQuestions(qs)
      setLoading(false)
    }
    load()
  }, [])

  // Timer countdown
  useEffect(() => {
    if (phase !== 'running' || timeMinutes === 0) return
    timerRef.current = setInterval(() => {
      setTimeLeft(t => Math.max(0, t - 1))
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [phase, timeMinutes])

  // Auto-finish when time runs out
  useEffect(() => {
    if (phase === 'running' && timeMinutes > 0 && timeLeft === 0 && !finishedRef.current) {
      finishedRef.current = true
      doFinish(simAnswersRef.current)
    }
  }, [timeLeft, phase, timeMinutes])

  function getPool() {
    if (selectedDisciplines.size > 0) {
      return allQuestions.filter(q => selectedDisciplines.has(q.discipline_id))
    }
    return allQuestions
  }

  function startSimulado() {
    const pool = getPool()
    const qs = shuffle(pool).slice(0, Math.min(questionCount, pool.length))
    finishedRef.current = false
    setQuestions(qs)
    setSimAnswers([])
    setCurrentIndex(0)
    setSelected(null)
    setTimeLeft(timeMinutes * 60)
    setPhase('running')
  }

  function handleNext() {
    const q = questions[currentIndex]
    const newAnswer: SimAnswer = {
      questionId: q.id,
      selected,
      isCorrect: selected === q.correct_answer,
      disciplineId: q.discipline_id,
    }
    const updated = [...simAnswersRef.current, newAnswer]
    setSimAnswers(updated)
    setSelected(null)

    if (currentIndex === questions.length - 1) {
      finishedRef.current = true
      doFinish(updated)
    } else {
      setCurrentIndex(i => i + 1)
    }
  }

  function doFinish(answers: SimAnswer[]) {
    if (timerRef.current) clearInterval(timerRef.current)
    for (const a of answers) {
      if (a.selected !== null) {
        recordAnswer({
          questionId: a.questionId,
          selectedAnswer: a.selected,
          isCorrect: a.isCorrect,
          answeredAt: new Date().toISOString(),
        })
      }
    }
    setPhase('result')
  }

  function formatTime(secs: number) {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const currentQuestion = questions[currentIndex]
  const pool = getPool()
  const maxQuestions = pool.length

  // ── LOADING ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  // ── SETUP ─────────────────────────────────────────────────────────────────────
  if (phase === 'setup') {
    const counts = [10, 20, 30, 50].filter(n => n <= maxQuestions)

    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header title="Simulado" showBack />
        <main className="mx-auto w-full max-w-lg flex-1 px-4 py-4 pb-24">
          <div className="flex flex-col gap-6">
            <p className="text-sm text-muted-foreground">
              Responda questões em condições reais de prova — sem gabarito durante o simulado. O resultado aparece só no final.
            </p>

            {/* Disciplines filter */}
            <div>
              <h2 className="font-semibold mb-1">Matérias</h2>
              <p className="text-xs text-muted-foreground mb-2">Deixe sem seleção para incluir todas.</p>
              <div className="flex flex-col gap-2">
                {disciplines.map(d => {
                  const count = allQuestions.filter(q => q.discipline_id === d.id).length
                  const sel = selectedDisciplines.has(d.id)
                  return (
                    <button
                      key={d.id}
                      onClick={() => {
                        const next = new Set(selectedDisciplines)
                        if (sel) next.delete(d.id); else next.add(d.id)
                        setSelectedDisciplines(next)
                      }}
                      className={cn(
                        'flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all',
                        sel ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
                      )}
                    >
                      <span className="text-xl">{d.icon}</span>
                      <span className="flex-1 font-medium text-sm">{d.name}</span>
                      <span className="text-xs text-muted-foreground">{count} questões</span>
                      {sel && <CheckCircle2 size={16} className="text-primary shrink-0" />}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Question count */}
            <div>
              <h2 className="font-semibold mb-2">Número de questões</h2>
              <div className="flex gap-2 flex-wrap">
                {counts.map(n => (
                  <button
                    key={n}
                    onClick={() => setQuestionCount(n)}
                    className={cn(
                      'rounded-lg border px-4 py-2 text-sm font-medium transition-all',
                      questionCount === n ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/50'
                    )}
                  >
                    {n}
                  </button>
                ))}
                <button
                  onClick={() => setQuestionCount(maxQuestions)}
                  className={cn(
                    'rounded-lg border px-4 py-2 text-sm font-medium transition-all',
                    questionCount === maxQuestions ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/50'
                  )}
                >
                  Todas ({maxQuestions})
                </button>
              </div>
            </div>

            {/* Time limit */}
            <div>
              <h2 className="font-semibold mb-2">Tempo disponível</h2>
              <div className="flex gap-2 flex-wrap">
                {[{ label: '15 min', value: 15 }, { label: '30 min', value: 30 }, { label: '1h', value: 60 }, { label: '2h', value: 120 }, { label: 'Sem limite', value: 0 }].map(t => (
                  <button
                    key={t.value}
                    onClick={() => setTimeMinutes(t.value)}
                    className={cn(
                      'rounded-lg border px-4 py-2 text-sm font-medium transition-all',
                      timeMinutes === t.value ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/50'
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {maxQuestions === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-4">
                Nenhuma questão disponível. Importe questões primeiro.
              </p>
            ) : (
              <button
                onClick={startSimulado}
                className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Iniciar Simulado — {Math.min(questionCount, maxQuestions)} questões
                {timeMinutes > 0 ? ` · ${timeMinutes} min` : ''}
              </button>
            )}
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  // ── RUNNING ───────────────────────────────────────────────────────────────────
  if (phase === 'running' && currentQuestion) {
    const options =
      currentQuestion.type === 'true_false'
        ? [{ letter: 'C', text: 'Certo' }, { letter: 'E', text: 'Errado' }]
        : (currentQuestion.options ?? [])

    const isLow = timeMinutes > 0 && timeLeft > 0 && timeLeft <= 60

    return (
      <div className="flex min-h-screen flex-col bg-background">
        {/* Sticky progress + timer bar */}
        <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-2">
          <div className="flex items-center gap-3 mb-1.5">
            <span className="text-xs text-muted-foreground shrink-0">
              {currentIndex + 1} / {questions.length}
            </span>
            <div className="flex-1">
              <ProgressBar value={currentIndex} max={questions.length} />
            </div>
            {timeMinutes > 0 && (
              <div className={cn(
                'flex items-center gap-1 text-sm font-mono font-semibold shrink-0',
                isLow ? 'text-red-500 animate-pulse' : 'text-muted-foreground'
              )}>
                <Clock size={13} />
                {formatTime(timeLeft)}
              </div>
            )}
          </div>
        </div>

        <main className="mx-auto w-full max-w-lg flex-1 px-4 py-4 pb-8">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Questão {currentIndex + 1} de {questions.length}</span>
              <span className={cn(
                'rounded-full px-2 py-0.5 text-xs font-medium',
                currentQuestion.type === 'true_false'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-primary/10 text-primary'
              )}>
                {currentQuestion.type === 'true_false' ? 'C/E' : 'Múltipla escolha'}
              </span>
            </div>

            <p className="text-base leading-relaxed">{currentQuestion.statement}</p>

            <div className={cn('flex flex-col gap-2', currentQuestion.type === 'true_false' && 'flex-row')}>
              {options.map(opt => (
                <button
                  key={opt.letter}
                  onClick={() => setSelected(opt.letter)}
                  className={cn(
                    'flex items-start gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors',
                    currentQuestion.type === 'true_false' && 'flex-1 justify-center',
                    selected === opt.letter
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary hover:bg-primary/5'
                  )}
                >
                  {currentQuestion.type !== 'true_false' && (
                    <span className="font-bold shrink-0">{opt.letter}.</span>
                  )}
                  <span>{opt.text}</span>
                </button>
              ))}
            </div>

            <button
              onClick={handleNext}
              disabled={!selected}
              className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
            >
              {currentIndex === questions.length - 1 ? 'Finalizar Simulado' : 'Próxima questão'}
            </button>

            <p className="text-center text-xs text-muted-foreground">
              Gabarito e comentários aparecem apenas no resultado final.
            </p>
          </div>
        </main>
      </div>
    )
  }

  // ── RESULT ────────────────────────────────────────────────────────────────────
  const answered = simAnswers.filter(a => a.selected !== null).length
  const correct = simAnswers.filter(a => a.isCorrect).length
  const wrong = answered - correct
  const skipped = questions.length - answered
  const percent = answered === 0 ? 0 : Math.round((correct / answered) * 100)

  const discBreakdown = disciplines
    .map(d => {
      const qs = questions.filter(q => q.discipline_id === d.id)
      if (qs.length === 0) return null
      const ans = simAnswers.filter(a => qs.some(q => q.id === a.questionId) && a.selected !== null)
      if (ans.length === 0) return null
      const c = ans.filter(a => a.isCorrect).length
      const disciplineSubjects = subjects.filter(s => s.discipline_id === d.id)
      const subBreakdown = disciplineSubjects.map(s => {
        const sQs = qs.filter(q => q.subject_id === s.id)
        const sAns = simAnswers.filter(a => sQs.some(q => q.id === a.questionId) && a.selected !== null)
        if (sAns.length === 0) return null
        const sC = sAns.filter(a => a.isCorrect).length
        return { subject: s, answered: sAns.length, correct: sC, percent: Math.round((sC / sAns.length) * 100) }
      }).filter(Boolean) as { subject: Subject; answered: number; correct: number; percent: number }[]
      return { discipline: d, answered: ans.length, correct: c, percent: Math.round((c / ans.length) * 100), subBreakdown }
    })
    .filter(Boolean) as { discipline: Discipline; answered: number; correct: number; percent: number; subBreakdown: { subject: Subject; answered: number; correct: number; percent: number }[] }[]

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header title="Resultado do Simulado" showBack={false} />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-4 pb-24">
        <div className="flex flex-col gap-5">
          {/* Score */}
          <div className="rounded-xl border border-border bg-card p-5 text-center">
            <p className={cn(
              'text-5xl font-bold mb-1',
              percent >= 70 ? 'text-green-500' : percent >= 50 ? 'text-amber-500' : 'text-red-500'
            )}>
              {percent}%
            </p>
            <p className="text-muted-foreground text-sm">Aproveitamento</p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-border bg-card p-3 text-center">
              <p className="text-2xl font-bold text-green-500">{correct}</p>
              <p className="text-xs text-muted-foreground">Acertos</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3 text-center">
              <p className="text-2xl font-bold text-red-500">{wrong}</p>
              <p className="text-xs text-muted-foreground">Erros</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3 text-center">
              <p className="text-2xl font-bold text-muted-foreground">{skipped}</p>
              <p className="text-xs text-muted-foreground">Puladas</p>
            </div>
          </div>

          {/* Breakdown by discipline + subject */}
          {discBreakdown.length > 0 && (
            <div>
              <h2 className="font-semibold mb-2">Desempenho por matéria</h2>
              <div className="flex flex-col gap-2">
                {discBreakdown.map(b => (
                  <div key={b.discipline.id} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span>{b.discipline.icon}</span>
                      <span className="flex-1 font-medium text-sm">{b.discipline.name}</span>
                      <span className={cn(
                        'font-bold text-sm',
                        b.percent >= 70 ? 'text-green-500' : b.percent >= 50 ? 'text-amber-500' : 'text-red-500'
                      )}>
                        {b.percent}%
                      </span>
                    </div>
                    <ProgressBar value={b.correct} max={b.answered} showLabel />
                    {b.subBreakdown.length > 1 && (
                      <div className="mt-3 flex flex-col gap-1.5 border-t border-border pt-3">
                        {b.subBreakdown.map(s => (
                          <div key={s.subject.id} className="flex items-center gap-2 text-xs">
                            <span className="flex-1 text-muted-foreground truncate">{s.subject.name}</span>
                            <span className="text-muted-foreground">{s.correct}/{s.answered}</span>
                            <span className={cn(
                              'font-semibold w-8 text-right',
                              s.percent >= 70 ? 'text-green-500' : s.percent >= 50 ? 'text-amber-500' : 'text-red-500'
                            )}>
                              {s.percent}%
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2">
            {wrong > 0 && (
              <button
                onClick={() => navigate('/errors')}
                className="rounded-xl border border-border px-4 py-3 text-sm font-medium hover:bg-muted/50"
              >
                Revisar {wrong} erro{wrong > 1 ? 's' : ''}
              </button>
            )}
            <button
              onClick={() => { setPhase('setup'); setSimAnswers([]) }}
              className="rounded-xl border border-border px-4 py-3 text-sm font-medium hover:bg-muted/50"
            >
              Novo simulado
            </button>
            <button
              onClick={() => navigate('/')}
              className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Voltar ao início
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
