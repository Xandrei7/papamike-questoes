import { supabase } from './supabase'
import type { Discipline, Subject, Question, Profile } from '@/types'

// ─── DISCIPLINES ─────────────────────────────────────────────────────────────

export async function getDisciplines(): Promise<Discipline[]> {
  const { data, error } = await supabase
    .from('disciplines')
    .select('*')
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function saveDiscipline(discipline: Partial<Discipline> & { name: string }) {
  if (discipline.id) {
    const { error } = await supabase
      .from('disciplines')
      .update({ name: discipline.name, icon: discipline.icon })
      .eq('id', discipline.id)
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('disciplines')
      .insert({ name: discipline.name, icon: discipline.icon ?? '📚' })
    if (error) throw error
  }
}

export async function deleteDiscipline(id: string) {
  const { error } = await supabase.from('disciplines').delete().eq('id', id)
  if (error) throw error
}

// ─── SUBJECTS ─────────────────────────────────────────────────────────────────

export async function getSubjects(disciplineId?: string): Promise<Subject[]> {
  let query = supabase.from('subjects').select('*').order('sort_order').order('name')
  if (disciplineId) query = query.eq('discipline_id', disciplineId)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function saveSubject(subject: Partial<Subject> & { name: string; discipline_id: string }) {
  if (subject.id) {
    const { error } = await supabase
      .from('subjects')
      .update({ name: subject.name, discipline_id: subject.discipline_id, sort_order: subject.sort_order ?? 0 })
      .eq('id', subject.id)
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('subjects')
      .insert({ name: subject.name, discipline_id: subject.discipline_id, sort_order: subject.sort_order ?? 0 })
    if (error) throw error
  }
}

export async function deleteSubject(id: string) {
  const { error } = await supabase.from('subjects').delete().eq('id', id)
  if (error) throw error
}

// ─── QUESTIONS ────────────────────────────────────────────────────────────────

export async function getQuestions(filter?: { subjectId?: string; disciplineId?: string }): Promise<Question[]> {
  let query = supabase.from('questions').select('*').order('sort_order').order('created_at')
  if (filter?.subjectId) query = query.eq('subject_id', filter.subjectId)
  if (filter?.disciplineId) query = query.eq('discipline_id', filter.disciplineId)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function saveQuestion(question: Partial<Question> & { statement: string; subject_id: string; discipline_id: string }) {
  const payload = {
    statement: question.statement,
    type: question.type ?? 'true_false',
    options: question.options ?? null,
    correct_answer: question.correct_answer ?? 'C',
    comment: question.comment ?? '',
    legal_basis: question.legal_basis ?? null,
    exam_tips: question.exam_tips ?? null,
    subject_id: question.subject_id,
    discipline_id: question.discipline_id,
    sort_order: question.sort_order ?? 0,
  }
  if (question.id) {
    const { error } = await supabase.from('questions').update(payload).eq('id', question.id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('questions').insert(payload)
    if (error) throw error
  }
}

export async function deleteQuestion(id: string) {
  const { error } = await supabase.from('questions').delete().eq('id', id)
  if (error) throw error
}

// ─── PROFILES ────────────────────────────────────────────────────────────────

export async function getProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function updateUserStatus(userId: string, newStatus: 'pending' | 'approved' | 'suspended' | 'revoked') {
  const { error } = await supabase
    .from('profiles')
    .update({ 
      status: newStatus,
      is_validated: newStatus === 'approved' // Sincroniza retrocompatibilidade se a DB antiga estiver em uso
    })
    .eq('user_id', userId)
  if (error) throw error
}

export async function forceCreateProfileFallback(user: { id: string; email: string; name?: string }, status: string, role: string) {
  // Chamada de emergência pelo AuthContext caso trigger DB falhe
  await supabase.from('profiles').upsert({
    user_id: user.id,
    email: user.email,
    name: user.name || user.email.split('@')[0],
    status: status,
    role: role,
    is_validated: status === 'approved'
  }, { onConflict: 'user_id' })
}

// ─── ROLES ───────────────────────────────────────────────────────────────────

export async function checkAdminRole(userId: string): Promise<boolean> {
  // Check user_roles table first
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .single()
  
  if (roleData) return true
  
  // Fallback check profile role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', userId)
    .single()
    
  return profile?.role === 'admin'
}

// ─── REPORTS ─────────────────────────────────────────────────────────────────

export async function submitReport(questionId: string, userId: string, message: string) {
  const { error } = await supabase.from('question_reports').insert({ question_id: questionId, user_id: userId, message })
  if (error) throw error
}

export async function getReports() {
  const { data, error } = await supabase.from('question_reports').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}
