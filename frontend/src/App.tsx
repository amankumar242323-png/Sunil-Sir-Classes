import React, { useEffect, useState, useRef, FormEvent } from 'react'
import {
  GraduationCap, BookOpen, ClipboardCheck, TrendingUp,
  Users, ShieldCheck, Menu, X, LogIn, LogOut, FileText,
  MessageCircleQuestion, CalendarDays, ArrowRight, CheckCircle2,
  Clock, Plus, Trash2, Eye, ExternalLink, HelpCircle, AlertCircle,
  Award, Sparkles, UserPlus
} from 'lucide-react'
import { api, clearSession, getUser, setSession } from './services/api'

type User = {
  id: number
  full_name: string
  email: string
  role: 'student' | 'faculty' | 'admin'
  phone?: string
  is_active: boolean
}

type Board = {
  id: number
  name: string
  code: string
}

type Grade = {
  id: number
  grade_number: number
  display_name: string
}

type AcademicYear = {
  id: number
  name: string
  is_active: boolean
}

type Subject = {
  id: number
  name: string
  code: string
  is_active: boolean
}

type Program = {
  board: string
  grade: number
  title: string
  mode: string
  description: string
}

type Material = {
  id: number
  title: string
  description?: string
  subject_id: number
  subject_name: string
  board_code: string
  grade_number: number
  material_type: string
  file_url: string
  batch_id?: number | null
  is_published: boolean
  created_at?: string
}

type TestQuestion = {
  prompt: string
  options: string[]
  marks?: number
  explanation?: string
  correct_index?: number
}

type Test = {
  id: number
  title: string
  description?: string
  subject_id: number
  subject_name: string
  board_code: string
  grade_number: number
  duration_minutes: number
  total_marks: number
  questions_count?: number
  is_published: boolean
  questions: TestQuestion[]
  created_at?: string
}

type TestResult = {
  attempt_id: number
  test_id?: number
  title: string
  score: number
  total_marks: number
  submitted_at?: string
}

type Doubt = {
  id: number
  student_id: number
  student_name: string
  student_email: string
  subject_id: number
  subject_name: string
  title: string
  question_text: string
  answer_text?: string | null
  status: 'open' | 'answered' | 'closed'
  created_at?: string
}

type Batch = {
  id: number
  name: string
  board_id: number
  board_name: string
  grade_id: number
  grade_display: string
  academic_year_id: number
  academic_year: string
  mode: string
  schedule_text?: string
  capacity: number
  enrolled_count: number
  is_active: boolean
}

type Enquiry = {
  id: number
  name: string
  phone: string
  email?: string | null
  board: string
  grade_number: number
  message?: string | null
  status: 'new' | 'contacted' | 'admitted' | 'closed'
  created_at?: string
}

type AdminStats = {
  users: number
  students: number
  faculty: number
  enquiries: number
  batches: number
  materials: number
  tests: number
  doubts: number
}

type StudentStats = {
  student: string
  enrolled_batches: { id: number; name: string; schedule_text: string; mode: string }[]
  completed_tests: number
  average_raw_score: number | null
  available_materials_count: number
  available_tests_count: number
  open_doubts_count: number
}

type FacultyStats = {
  faculty: string
  materials_count: number
  tests_count: number
  pending_doubts: number
  active_batches: number
}

type Notice = { kind: 'success' | 'error'; text: string }

export default function App() {
  const [user, setUser] = useState<User | null>(getUser())
  const [page, setPage] = useState('home')
  const [mobile, setMobile] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [loading, setLoading] = useState(false)

  // Public & Academics Metadata
  const [boards, setBoards] = useState<Board[]>([])
  const [grades, setGrades] = useState<Grade[]>([])
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [programs, setPrograms] = useState<Program[]>([])

  // Student / Faculty / Admin Entities
  const [materials, setMaterials] = useState<Material[]>([])
  const [tests, setTests] = useState<Test[]>([])
  const [results, setResults] = useState<TestResult[]>([])
  const [doubts, setDoubts] = useState<Doubt[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [enquiries, setEnquiries] = useState<Enquiry[]>([])
  const [usersList, setUsersList] = useState<User[]>([])
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null)
  const [studentStats, setStudentStats] = useState<StudentStats | null>(null)
  const [facultyStats, setFacultyStats] = useState<FacultyStats | null>(null)

  // Filters
  const [filterGrade, setFilterGrade] = useState<number | 'all'>('all')
  const [filterSubject, setFilterSubject] = useState<number | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [enquiryStatusFilter, setEnquiryStatusFilter] = useState('all')

  // Auth Forms
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [registerForm, setRegisterForm] = useState({ full_name: '', email: '', password: '', phone: '' })

  // Enquiry Form
  const [enquiryForm, setEnquiryForm] = useState({
    name: '',
    phone: '',
    email: '',
    board: 'CBSE',
    grade_number: 10,
    message: ''
  })

  // Test Taking State
  const [activeAttempt, setActiveAttempt] = useState<any>(null)
  const [currentQIndex, setCurrentQIndex] = useState(0)
  const [answerChoice, setAnswerChoice] = useState<Record<number, number>>({})
  const [timeLeft, setTimeLeft] = useState<number>(0)
  const [reviewAttempt, setReviewAttempt] = useState<any>(null)
  const timerRef = useRef<any>(null)

  // Creation Modals & Forms
  const [showBatchModal, setShowBatchModal] = useState(false)
  const [newBatch, setNewBatch] = useState({
    name: '',
    board_id: 1,
    grade_id: 2,
    academic_year_id: 1,
    schedule_text: 'Mon-Sat · 07:00 AM - 09:00 AM',
    capacity: 40
  })

  const [showEnrollModal, setShowEnrollModal] = useState(false)
  const [enrollForm, setEnrollForm] = useState({ student_id: 0, batch_id: 0 })

  const [showUserModal, setShowUserModal] = useState(false)
  const [newUser, setNewUser] = useState({
    full_name: '',
    email: '',
    password: '',
    phone: '',
    role: 'student' as 'student' | 'faculty' | 'admin'
  })

  const [showAnswerModal, setShowAnswerModal] = useState(false)
  const [activeDoubtToAnswer, setActiveDoubtToAnswer] = useState<any>(null)
  const [doubtAnswerText, setDoubtAnswerText] = useState('')

  // Doubt Submission
  const [newDoubt, setNewDoubt] = useState({ subject_id: 1, title: '', question_text: '' })

  // Material Creation Form
  const [newMaterial, setNewMaterial] = useState({
    title: '',
    description: '',
    board_id: 1,
    grade_id: 2,
    subject_id: 1,
    material_type: 'notes',
    file_url: 'https://ncert.nic.in/textbook/pdf/jesc101.pdf',
    is_published: true
  })

  // Multi-Question Test Creation Form
  const [newTest, setNewTest] = useState({
    title: '',
    description: '',
    board_id: 1,
    grade_id: 2,
    subject_id: 1,
    duration_minutes: 20,
    is_published: true,
    questions: [
      {
        prompt: 'Which chemical reaction involves exchange of ions between reactants?',
        options: [
          'Double displacement reaction',
          'Combination reaction',
          'Decomposition reaction',
          'Displacement reaction'
        ],
        correct_index: 0,
        marks: 2,
        explanation: 'In double displacement reactions, positive and negative ions exchange partner compounds.'
      }
    ]
  })

  const flash = (text: string, kind: 'success' | 'error' = 'success') => {
    setNotice({ text, kind })
    window.setTimeout(() => setNotice(null), 4500)
  }

  // Load public academic metadata
  const loadMetadata = async () => {
    try {
      const [b, g, s, p, y] = await Promise.all([
        api('/boards').catch(() => []),
        api('/grades').catch(() => []),
        api('/subjects').catch(() => []),
        api('/programs').catch(() => ({ programs: [] })),
        api('/academic-years').catch(() => [])
      ])
      setBoards(b)
      setGrades(g)
      setSubjects(s)
      setPrograms(p.programs || [])
      setAcademicYears(y)
      if (s.length > 0) {
        setNewDoubt(prev => ({ ...prev, subject_id: s[0].id }))
        setNewMaterial(prev => ({ ...prev, subject_id: s[0].id }))
        setNewTest(prev => ({ ...prev, subject_id: s[0].id }))
      }
      if (b.length > 0) {
        setNewBatch(prev => ({ ...prev, board_id: b[0].id }))
        setNewMaterial(prev => ({ ...prev, board_id: b[0].id }))
        setNewTest(prev => ({ ...prev, board_id: b[0].id }))
      }
      if (g.length > 0) {
        setNewBatch(prev => ({ ...prev, grade_id: g[0].id }))
        setNewMaterial(prev => ({ ...prev, grade_id: g[0].id }))
        setNewTest(prev => ({ ...prev, grade_id: g[0].id }))
      }
      if (y.length > 0) {
        setNewBatch(prev => ({ ...prev, academic_year_id: y[0].id }))
      }
    } catch {
      // Fallback
    }
  }

  // Load private data based on role
  const loadPrivateData = async () => {
    if (!user) return
    try {
      if (user.role === 'student') {
        const [dash, m, t, r, d, b] = await Promise.all([
          api('/students/me/dashboard').catch(() => null),
          api('/materials').catch(() => []),
          api('/tests').catch(() => []),
          api('/students/me/results').catch(() => []),
          api('/doubts').catch(() => []),
          api('/batches').catch(() => [])
        ])
        setStudentStats(dash)
        setMaterials(m)
        setTests(t)
        setResults(r)
        setDoubts(d)
        setBatches(b)
      } else if (user.role === 'faculty') {
        const [fDash, m, t, d, b] = await Promise.all([
          api('/faculty/dashboard').catch(() => null),
          api('/materials').catch(() => []),
          api('/tests').catch(() => []),
          api('/doubts').catch(() => []),
          api('/batches').catch(() => [])
        ])
        setFacultyStats(fDash)
        setMaterials(m)
        setTests(t)
        setDoubts(d)
        setBatches(b)
      } else if (user.role === 'admin') {
        const [s, e, u, b, m, t, d] = await Promise.all([
          api('/admin/dashboard').catch(() => null),
          api('/admin/admissions').catch(() => []),
          api('/admin/users').catch(() => []),
          api('/batches').catch(() => []),
          api('/materials').catch(() => []),
          api('/tests').catch(() => []),
          api('/doubts').catch(() => [])
        ])
        setAdminStats(s)
        setEnquiries(e)
        setUsersList(u)
        setBatches(b)
        setMaterials(m)
        setTests(t)
        setDoubts(d)
      }
    } catch (err: any) {
      flash(err.message, 'error')
    }
  }

  useEffect(() => {
    loadMetadata()
  }, [])

  useEffect(() => {
    loadPrivateData()
  }, [user])

  // Timer for active test
  useEffect(() => {
    if (page !== 'take-test' || !activeAttempt) {
      if (timerRef.current) clearInterval(timerRef.current)
      return
    }
    if (timeLeft <= 0) {
      if (timerRef.current) clearInterval(timerRef.current)
      submitTest()
      return
    }
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => Math.max(0, prev - 1))
    }, 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [page, activeAttempt, timeLeft === 0])

  // Sign In
  const handleSignIn = async (e?: FormEvent, customCreds?: { email: string; password: string }) => {
    if (e) e.preventDefault()
    setLoading(true)
    const creds = customCreds || loginForm
    try {
      const data = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify(creds)
      })
      setSession(data.access_token, data.user)
      setUser(data.user)
      setPage('dashboard')
      flash(`Welcome back, ${data.user.full_name}! 👋`)
    } catch (err: any) {
      flash(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  // Register Student
  const handleRegister = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const data = await api('/auth/register', {
        method: 'POST',
        body: JSON.stringify(registerForm)
      })
      setSession(data.access_token, data.user)
      setUser(data.user)
      setPage('dashboard')
      flash(`Account created! Welcome to Sunil Sir Classes, ${data.user.full_name}!`)
    } catch (err: any) {
      flash(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const signOut = () => {
    clearSession()
    setUser(null)
    setPage('home')
    flash('Signed out successfully.')
  }

  // Quick 1-click Demo Logins
  const demoLogin = (role: 'student' | 'faculty' | 'admin') => {
    if (role === 'admin') {
      handleSignIn(undefined, { email: 'admin@sunilsirclasses.example', password: 'SunilAdmin123!' })
    } else if (role === 'faculty') {
      handleSignIn(undefined, { email: 'faculty@sunilsirclasses.example', password: 'SunilFaculty123!' })
    } else {
      handleSignIn(undefined, { email: 'student@sunilsirclasses.example', password: 'SunilStudent123!' })
    }
  }

  // Submit Admission Enquiry
  const submitEnquiry = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const data = await api('/admissions/enquiries', {
        method: 'POST',
        body: JSON.stringify({
          ...enquiryForm,
          grade_number: Number(enquiryForm.grade_number),
          email: enquiryForm.email || null
        })
      })
      flash(data.message)
      setEnquiryForm({ name: '', phone: '', email: '', board: 'CBSE', grade_number: 10, message: '' })
      loadPrivateData()
    } catch (err: any) {
      flash(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  // Update Enquiry Status (Admin)
  const updateEnquiryStatus = async (id: number, status: string) => {
    try {
      await api(`/admin/admissions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      })
      flash(`Enquiry status marked as '${status}'`)
      loadPrivateData()
    } catch (err: any) {
      flash(err.message, 'error')
    }
  }

  // Submit Doubt (Student)
  const submitDoubt = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api('/doubts', {
        method: 'POST',
        body: JSON.stringify({
          subject_id: Number(newDoubt.subject_id),
          title: newDoubt.title,
          question_text: newDoubt.question_text
        })
      })
      flash('Your doubt has been submitted! Faculty will answer soon.')
      setNewDoubt(prev => ({ ...prev, title: '', question_text: '' }))
      loadPrivateData()
    } catch (err: any) {
      flash(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  // Answer Doubt (Faculty / Admin)
  const submitDoubtAnswer = async (e: FormEvent) => {
    e.preventDefault()
    if (!activeDoubtToAnswer) return
    try {
      await api(`/doubts/${activeDoubtToAnswer.id}/answer`, {
        method: 'PATCH',
        body: JSON.stringify({
          answer_text: doubtAnswerText,
          status: 'answered'
        })
      })
      flash('Answer submitted and sent to student!')
      setShowAnswerModal(false)
      setDoubtAnswerText('')
      setActiveDoubtToAnswer(null)
      loadPrivateData()
    } catch (err: any) {
      flash(err.message, 'error')
    }
  }

  // Start Test
  const startTest = async (testId: number) => {
    try {
      const data = await api(`/tests/${testId}/attempts`, { method: 'POST' })
      setActiveAttempt(data)
      setCurrentQIndex(0)
      setAnswerChoice({})
      setTimeLeft((data.test.duration_minutes || 20) * 60)
      setPage('take-test')
    } catch (err: any) {
      flash(err.message, 'error')
    }
  }

  // Submit Test
  const submitTest = async () => {
    if (!activeAttempt) return
    try {
      const answers: Record<string, number> = {}
      Object.entries(answerChoice).forEach(([k, v]) => {
        answers[String(k)] = v
      })
      const data = await api(`/attempts/${activeAttempt.attempt_id}/submit`, {
        method: 'POST',
        body: JSON.stringify({ answers })
      })
      // Fetch full review
      const review = await api(`/attempts/${activeAttempt.attempt_id}`)
      setReviewAttempt(review)
      setActiveAttempt(null)
      setPage('results')
      flash(`Test submitted! You scored ${data.score} / ${data.total_marks} (${data.percentage}%)`)
      loadPrivateData()
    } catch (err: any) {
      flash(err.message, 'error')
    }
  }

  // View Past Test Review
  const viewAttemptReview = async (attemptId: number) => {
    try {
      const review = await api(`/attempts/${attemptId}`)
      setReviewAttempt(review)
      setPage('results')
    } catch (err: any) {
      flash(err.message, 'error')
    }
  }

  // Create Batch (Admin)
  const handleCreateBatch = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await api('/admin/batches', {
        method: 'POST',
        body: JSON.stringify({
          ...newBatch,
          board_id: Number(newBatch.board_id),
          grade_id: Number(newBatch.grade_id),
          academic_year_id: Number(newBatch.academic_year_id),
          capacity: Number(newBatch.capacity)
        })
      })
      flash('Batch created successfully!')
      setShowBatchModal(false)
      loadPrivateData()
    } catch (err: any) {
      flash(err.message, 'error')
    }
  }

  // Enroll Student (Admin)
  const handleEnrollStudent = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await api('/admin/enrollments', {
        method: 'POST',
        body: JSON.stringify({
          student_id: Number(enrollForm.student_id),
          batch_id: Number(enrollForm.batch_id)
        })
      })
      flash('Student successfully enrolled in batch!')
      setShowEnrollModal(false)
      loadPrivateData()
    } catch (err: any) {
      flash(err.message, 'error')
    }
  }

  // Create User (Admin)
  const handleCreateUser = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await api('/admin/users', {
        method: 'POST',
        body: JSON.stringify(newUser)
      })
      flash(`User account for ${newUser.full_name} created as ${newUser.role}!`)
      setShowUserModal(false)
      setNewUser({ full_name: '', email: '', password: '', phone: '', role: 'student' })
      loadPrivateData()
    } catch (err: any) {
      flash(err.message, 'error')
    }
  }

  // Create Material (Faculty / Admin)
  const handleCreateMaterial = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await api('/admin/materials', {
        method: 'POST',
        body: JSON.stringify({
          ...newMaterial,
          board_id: Number(newMaterial.board_id),
          grade_id: Number(newMaterial.grade_id),
          subject_id: Number(newMaterial.subject_id)
        })
      })
      flash('Study resource published successfully!')
      setNewMaterial(prev => ({ ...prev, title: '', description: '' }))
      loadPrivateData()
    } catch (err: any) {
      flash(err.message, 'error')
    }
  }

  // Create Test with Multi-Question Builder (Faculty / Admin)
  const handleCreateTest = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await api('/admin/tests', {
        method: 'POST',
        body: JSON.stringify({
          ...newTest,
          board_id: Number(newTest.board_id),
          grade_id: Number(newTest.grade_id),
          subject_id: Number(newTest.subject_id),
          duration_minutes: Number(newTest.duration_minutes)
        })
      })
      flash(`Assessment '${newTest.title}' created with ${newTest.questions.length} questions!`)
      setNewTest(prev => ({
        ...prev,
        title: '',
        description: '',
        questions: [
          {
            prompt: '',
            options: ['', '', '', ''],
            correct_index: 0,
            marks: 1,
            explanation: ''
          }
        ]
      }))
      loadPrivateData()
    } catch (err: any) {
      flash(err.message, 'error')
    }
  }

  // Toggle Publish & Delete helpers
  const toggleMaterial = async (id: number) => {
    try {
      await api(`/admin/materials/${id}/toggle-publish`, { method: 'PATCH' })
      flash('Material publication status updated')
      loadPrivateData()
    } catch (err: any) {
      flash(err.message, 'error')
    }
  }

  const deleteMaterial = async (id: number) => {
    if (!confirm('Are you sure you want to delete this study material?')) return
    try {
      await api(`/admin/materials/${id}`, { method: 'DELETE' })
      flash('Material deleted')
      loadPrivateData()
    } catch (err: any) {
      flash(err.message, 'error')
    }
  }

  const toggleTest = async (id: number) => {
    try {
      await api(`/admin/tests/${id}/toggle-publish`, { method: 'PATCH' })
      flash('Test publication status updated')
      loadPrivateData()
    } catch (err: any) {
      flash(err.message, 'error')
    }
  }

  const deleteTest = async (id: number) => {
    if (!confirm('Are you sure you want to delete this test?')) return
    try {
      await api(`/admin/tests/${id}`, { method: 'DELETE' })
      flash('Test deleted')
      loadPrivateData()
    } catch (err: any) {
      flash(err.message, 'error')
    }
  }

  // User Management (Admin)
  const toggleUserStatus = async (userId: number) => {
    try {
      await api(`/admin/users/${userId}/status`, { method: 'PATCH' })
      flash('User status updated')
      loadPrivateData()
    } catch (err: any) {
      flash(err.message, 'error')
    }
  }

  const deleteUser = async (userId: number, name: string) => {
    if (!confirm(`Are you sure you want to delete user account for ${name}?`)) return
    try {
      await api(`/admin/users/${userId}`, { method: 'DELETE' })
      flash(`User account for ${name} deleted`)
      loadPrivateData()
    } catch (err: any) {
      flash(err.message, 'error')
    }
  }

  // Navigation Links
  const navItems = user
    ? user.role === 'admin'
      ? [
        ['dashboard', 'Dashboard'],
        ['admissions', 'Admissions'],
        ['batches', 'Batches'],
        ['users', 'Users'],
        ['materials', 'Materials'],
        ['tests', 'Tests'],
        ['doubts', 'Doubts']
      ]
      : user.role === 'faculty'
        ? [
          ['dashboard', 'Dashboard'],
          ['materials', 'Materials'],
          ['tests', 'Tests'],
          ['doubts', 'Student Doubts'],
          ['create-material', 'Upload Notes'],
          ['create-test', 'Create Test']
        ]
        : [
          ['dashboard', 'Dashboard'],
          ['materials', 'Study Library'],
          ['tests', 'Online Tests'],
          ['results', 'My Results'],
          ['doubts', 'Ask a Doubt']
        ]
    : [
      ['home', 'Home'],
      ['courses', 'Classes 9th–12th'],
      ['admission', 'Admission Enquiry'],
      ['login', 'Student & Faculty Portal']
    ]

  const go = (p: string) => {
    setPage(p)
    setMobile(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Filtered materials
  const filteredMaterials = materials.filter(m => {
    const matchGrade = filterGrade === 'all' || m.grade_number === filterGrade
    const matchSubject = filterSubject === 'all' || m.subject_id === filterSubject
    const matchSearch =
      !searchQuery ||
      m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.description && m.description.toLowerCase().includes(searchQuery.toLowerCase()))
    return matchGrade && matchSubject && matchSearch
  })

  // Format timer
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  return (
    <div className="app-shell">
      {/* Quick Demo Shortcuts Bar */}
      <div className="demo-banner">
        <span>
          <Sparkles size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
          <strong>Quick Demo Switcher:</strong> Explore all roles with 1-click test accounts
        </span>
        <div className="demo-pills">
          <button className="demo-btn" onClick={() => demoLogin('student')}>
            👤 Login as Student (Rohan)
          </button>
          <button className="demo-btn" onClick={() => demoLogin('faculty')}>
            👨‍🏫 Login as Faculty (Er. Amit)
          </button>
          <button className="demo-btn" onClick={() => demoLogin('admin')}>
            🛡️ Login as Admin (Sunil Sir)
          </button>
        </div>
      </div>

      {/* Top Navbar */}
      <header className="topbar">
        <a className="brand" href="#" onClick={e => { e.preventDefault(); go(user ? 'dashboard' : 'home') }}>
          <span className="brand-mark">
            <GraduationCap size={26} />
          </span>
          <div>
            <span className="brand-title">SUNIL SIR CLASSES</span>
            <span className="brand-subtitle">EXCELLENCE IN EDUCATION</span>
          </div>
        </a>

        <button className="mobile-toggle" onClick={() => setMobile(!mobile)} aria-label="Toggle menu">
          {mobile ? <X size={22} /> : <Menu size={22} />}
        </button>

        <nav className={`nav-links ${mobile ? 'open' : ''}`}>
          {navItems.map(([p, label]) => (
            <button
              key={p}
              className={`nav-link ${page === p ? 'active' : ''}`}
              onClick={() => go(p)}
            >
              {label}
            </button>
          ))}

          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 8 }}>
              <span className="user-badge">
                <span className={`role-tag ${user.role}`}>{user.role}</span>
                <span>{user.full_name.split(' ')[0]}</span>
              </span>
              <button className="button button-danger button-sm" onClick={signOut}>
                <LogOut size={14} /> Logout
              </button>
            </div>
          ) : (
            <button className="button button-primary button-sm" onClick={() => go('login')}>
              <LogIn size={15} /> Sign In
            </button>
          )}
        </nav>
      </header>

      {/* Toast Notification */}
      {notice && (
        <div className={`toast ${notice.kind}`}>
          {notice.kind === 'success' ? <CheckCircle2 size={18} color="#10b981" /> : <AlertCircle size={18} color="#ef4444" />}
          <span>{notice.text}</span>
        </div>
      )}

      {/* MAIN VIEW CONTROLLER */}
      <main>
        {/* 1. HOME PAGE */}
        {page === 'home' && (
          <>
            <section className="hero">
              <div className="hero-copy">
                <span className="eyebrow">
                  <Sparkles size={14} /> CLASSES 9TH, 10TH, 11TH & 12TH (CBSE & UP BOARD)
                </span>
                <h1>
                  Master Concepts.<br />
                  Crack Exams.<br />
                  <em>Lead Your Batch.</em>
                </h1>
                <p>
                  Experience the perfect blend of offline classroom coaching by Sunil Sir with
                  structured online study notes, timed chapter tests, and personalized doubt resolution.
                </p>
                <div className="hero-actions">
                  <button className="button button-primary" onClick={() => go('admission')}>
                    Apply for Admission <ArrowRight size={17} />
                  </button>
                  <button className="button button-light" onClick={() => go('courses')}>
                    View Academic Batches
                  </button>
                </div>
                <div className="hero-features">
                  <div className="hero-feature-item">
                    <CheckCircle2 size={16} color="#60a5fa" />
                    <span>Daily Concept Clarity</span>
                  </div>
                  <div className="hero-feature-item">
                    <CheckCircle2 size={16} color="#60a5fa" />
                    <span>NCERT & Exemplar Focus</span>
                  </div>
                  <div className="hero-feature-item">
                    <CheckCircle2 size={16} color="#60a5fa" />
                    <span>Weekly Board Mock Tests</span>
                  </div>
                </div>
              </div>

              <div className="hero-art">
                <div className="hero-card-main">
                  <GraduationCap size={72} color="#93c5fd" />
                  <h3 style={{ color: '#fff', marginTop: 16 }}>SUNIL SIR CLASSES</h3>
                  <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: 4 }}>
                    Learn · Practice · Excel
                  </p>
                </div>
                <div className="floating-chip top-right">
                  <BookOpen size={24} color="#1d4ed8" />
                  <div>
                    <strong style={{ fontSize: '0.85rem', display: 'block' }}>Verified Notes</strong>
                    <small style={{ color: '#64748b' }}>Formulas & Derivations</small>
                  </div>
                </div>
                <div className="floating-chip bottom-left">
                  <ClipboardCheck size={24} color="#10b981" />
                  <div>
                    <strong style={{ fontSize: '0.85rem', display: 'block' }}>Timed Tests</strong>
                    <small style={{ color: '#64748b' }}>Instant Evaluation</small>
                  </div>
                </div>
              </div>
            </section>

            {/* Class Cards Section */}
            <section className="section">
              <div className="section-header">
                <span className="eyebrow">ACADEMIC DIVISIONS</span>
                <h2>Coaching Programs for Every Stage</h2>
                <p>Tailored batches focusing on board syllabus, scoring techniques, and deep conceptual understanding.</p>
              </div>

              <div className="grid-4">
                {[
                  { g: 9, title: 'Class 9th Foundation', desc: 'Build solid basics in Mathematics & Science for upcoming high-school boards.', badge: 'Foundation' },
                  { g: 10, title: 'Class 10th Board Achievers', desc: 'Rigorous CBSE & UP Board prep with past 10-year question solving & answer-writing.', badge: 'Board Target' },
                  { g: 11, title: 'Class 11th Science Stream', desc: 'Core Physics, Chemistry & Maths transition with JEE/NEET foundational concepts.', badge: 'Competitive Prep' },
                  { g: 12, title: 'Class 12th Board & Target', desc: 'Derivations mastery, sample papers, mock tests, and high-percentage board focus.', badge: 'Final Target' }
                ].map(item => (
                  <div
                    key={item.g}
                    className="grade-card"
                    onClick={() => {
                      setEnquiryForm(prev => ({ ...prev, grade_number: item.g }))
                      go('admission')
                    }}
                  >
                    <div className={`grade-badge grade-${item.g}`}>{item.g}</div>
                    <div style={{ flex: 1 }}>
                      <span className="status-pill new" style={{ marginBottom: 6 }}>{item.badge}</span>
                      <h3 style={{ fontSize: '1.05rem', marginTop: 4 }}>{item.title}</h3>
                      <p style={{ fontSize: '0.82rem', color: '#64748b', marginTop: 4 }}>{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Why Choose Sunil Sir Section */}
            <section className="section" style={{ background: '#f1f5f9' }}>
              <div className="section-header">
                <span className="eyebrow">OUR METHODOLOGY</span>
                <h2>Why Students Succeed at Sunil Sir Classes</h2>
                <p>We combine personal mentorship with structured digital resources for complete mastery.</p>
              </div>

              <div className="grid-3">
                <div className="card">
                  <div className="stat-icon" style={{ background: '#e0f2fe', color: '#0284c7' }}>
                    <BookOpen size={24} />
                  </div>
                  <h3 style={{ marginTop: 16 }}>Chapter-wise Study Materials</h3>
                  <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: 8 }}>
                    Concise formula sheets, theory summaries, and NCERT exemplar worksheets curated specifically for high board marks.
                  </p>
                </div>

                <div className="card">
                  <div className="stat-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
                    <ClipboardCheck size={24} />
                  </div>
                  <h3 style={{ marginTop: 16 }}>Live Online Test Engine</h3>
                  <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: 8 }}>
                    Timed practice quizzes with instant scoring, question explanations, and progress metrics to identify weak areas.
                  </p>
                </div>

                <div className="card">
                  <div className="stat-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
                    <HelpCircle size={24} />
                  </div>
                  <h3 style={{ marginTop: 16 }}>Dedicated Doubt Clearing</h3>
                  <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: 8 }}>
                    Never stay stuck on a question. Post your doubts directly from your student portal and receive answers from faculty.
                  </p>
                </div>
              </div>
            </section>

            {/* CTA Strip */}
            <section className="section" style={{ textAlign: 'center', background: '#fff' }}>
              <div className="section-narrow">
                <h2>Ready to elevate your academic performance?</h2>
                <p style={{ color: '#64748b', margin: '14px 0 28px' }}>
                  Limited batch capacity to ensure individual attention for every student.
                </p>
                <button className="button button-primary" onClick={() => go('admission')}>
                  Submit Admission Enquiry <ArrowRight size={16} />
                </button>
              </div>
            </section>
          </>
        )}

        {/* 2. COURSES / CLASSES PAGE */}
        {page === 'courses' && (
          <section className="section section-narrow">
            <div className="section-header">
              <span className="eyebrow">ACADEMIC DIRECTORY</span>
              <h1>Class Offerings & Syllabus</h1>
              <p>Explore programs tailored for CBSE and UP Board students with subject listings.</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {programs.map((prog, idx) => (
                <div key={idx} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20 }}>
                  <div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                      <span className="status-pill new">{prog.board}</span>
                      <span className="status-pill contacted">Class {prog.grade}</span>
                    </div>
                    <h3>{prog.title}</h3>
                    <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: 4 }}>{prog.description}</p>
                    <small style={{ color: '#1d4ed8', fontWeight: 600, display: 'block', marginTop: 8 }}>
                      Mode: {prog.mode}
                    </small>
                  </div>
                  <button
                    className="button button-primary button-sm"
                    onClick={() => {
                      setEnquiryForm(prev => ({ ...prev, board: prog.board, grade_number: prog.grade }))
                      go('admission')
                    }}
                  >
                    Enquire <ArrowRight size={14} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 3. ADMISSION ENQUIRY PAGE */}
        {page === 'admission' && (
          <section className="section section-narrow">
            <div className="section-header">
              <span className="eyebrow">JOIN SUNIL SIR CLASSES</span>
              <h1>Admission Enquiry Form</h1>
              <p>Fill out the details below. Our academic counselling team will contact you with batch schedules and fee details.</p>
            </div>

            <form className="form-card" onSubmit={submitEnquiry}>
              <div className="form-row">
                <div className="form-group">
                  <label>Student Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Aryan Gupta"
                    value={enquiryForm.name}
                    onChange={e => setEnquiryForm({ ...enquiryForm, name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Mobile Number (Parent or Student) *</label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. +91 98765 43210"
                    value={enquiryForm.phone}
                    onChange={e => setEnquiryForm({ ...enquiryForm, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Email Address (Optional)</label>
                  <input
                    type="email"
                    placeholder="e.g. student@example.com"
                    value={enquiryForm.email}
                    onChange={e => setEnquiryForm({ ...enquiryForm, email: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Education Board *</label>
                  <select
                    value={enquiryForm.board}
                    onChange={e => setEnquiryForm({ ...enquiryForm, board: e.target.value })}
                  >
                    <option value="CBSE">Central Board of Secondary Education (CBSE)</option>
                    <option value="UPMSP">UP Board (Madhyamik Shiksha Parishad)</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Target Class *</label>
                <select
                  value={enquiryForm.grade_number}
                  onChange={e => setEnquiryForm({ ...enquiryForm, grade_number: Number(e.target.value) })}
                >
                  <option value={9}>Class 9th</option>
                  <option value={10}>Class 10th</option>
                  <option value={11}>Class 11th</option>
                  <option value={12}>Class 12th</option>
                </select>
              </div>

              <div className="form-group">
                <label>Message / Specific Questions (Optional)</label>
                <textarea
                  rows={3}
                  placeholder="Tell us about preferred batch timings or subjects you need extra help in..."
                  value={enquiryForm.message}
                  onChange={e => setEnquiryForm({ ...enquiryForm, message: e.target.value })}
                />
              </div>

              <button className="button button-primary" type="submit" disabled={loading} style={{ width: '100%' }}>
                {loading ? 'Submitting Enquiry...' : 'Submit Enquiry'} <ArrowRight size={16} />
              </button>
            </form>
          </section>
        )}

        {/* 4. LOGIN & REGISTER PAGE */}
        {page === 'login' && !user && (
          <section className="section section-narrow">
            <div className="form-card" style={{ maxWidth: 480, margin: '0 auto' }}>
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <span className="brand-mark" style={{ margin: '0 auto 12px' }}>
                  <ShieldCheck size={24} />
                </span>
                <h2>{authMode === 'login' ? 'Portal Sign In' : 'Create Student Account'}</h2>
                <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: 4 }}>
                  Access study materials, practice tests, and coaching doubts
                </p>
              </div>

              {/* Mode Toggle */}
              <div className="tabs-header" style={{ justifyContent: 'center' }}>
                <button
                  className={`tab-btn ${authMode === 'login' ? 'active' : ''}`}
                  onClick={() => setAuthMode('login')}
                >
                  Sign In
                </button>
                <button
                  className={`tab-btn ${authMode === 'register' ? 'active' : ''}`}
                  onClick={() => setAuthMode('register')}
                >
                  New Student Registration
                </button>
              </div>

              {authMode === 'login' ? (
                <form onSubmit={handleSignIn}>
                  <div className="form-group">
                    <label>Email Address</label>
                    <input
                      type="email"
                      required
                      placeholder="you@sunilsirclasses.example"
                      value={loginForm.email}
                      onChange={e => setLoginForm({ ...loginForm, email: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Password</label>
                    <input
                      type="password"
                      required
                      placeholder="Enter your password"
                      value={loginForm.password}
                      onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
                    />
                  </div>
                  <button className="button button-primary" type="submit" disabled={loading} style={{ width: '100%' }}>
                    {loading ? 'Signing in...' : 'Sign In'} <ArrowRight size={16} />
                  </button>
                </form>
              ) : (
                <form onSubmit={handleRegister}>
                  <div className="form-group">
                    <label>Student Full Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Rohan Verma"
                      value={registerForm.full_name}
                      onChange={e => setRegisterForm({ ...registerForm, full_name: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Email Address *</label>
                    <input
                      type="email"
                      required
                      placeholder="rohan@example.com"
                      value={registerForm.email}
                      onChange={e => setRegisterForm({ ...registerForm, email: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Phone Number (Optional)</label>
                    <input
                      type="tel"
                      placeholder="+91 98765 43210"
                      value={registerForm.phone}
                      onChange={e => setRegisterForm({ ...registerForm, phone: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Create Password (min 6 characters) *</label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      placeholder="Choose a secure password"
                      value={registerForm.password}
                      onChange={e => setRegisterForm({ ...registerForm, password: e.target.value })}
                    />
                  </div>
                  <button className="button button-primary" type="submit" disabled={loading} style={{ width: '100%' }}>
                    {loading ? 'Creating Account...' : 'Complete Registration'} <ArrowRight size={16} />
                  </button>
                </form>
              )}

              {/* Demo Logins inside form */}
              <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid #e2e8f0', textAlign: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
                  Quick 1-Click Demo Accounts:
                </span>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 10, flexWrap: 'wrap' }}>
                  <button className="demo-btn" style={{ color: '#0f172a', borderColor: '#cbd5e1' }} onClick={() => demoLogin('student')}>
                    Student
                  </button>
                  <button className="demo-btn" style={{ color: '#0f172a', borderColor: '#cbd5e1' }} onClick={() => demoLogin('faculty')}>
                    Faculty
                  </button>
                  <button className="demo-btn" style={{ color: '#0f172a', borderColor: '#cbd5e1' }} onClick={() => demoLogin('admin')}>
                    Admin
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 5. USER DASHBOARDS */}
        {page === 'dashboard' && user && (
          <section className="section">
            <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <span className="eyebrow">{user.role.toUpperCase()} WORKSPACE</span>
                <h1>Welcome back, {user.full_name} 👋</h1>
                <p>Sunil Sir Classes academic management and learning portal.</p>
              </div>

              {user.role === 'admin' && (
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="button button-primary button-sm" onClick={() => setShowBatchModal(true)}>
                    <Plus size={14} /> New Batch
                  </button>
                  <button className="button button-light button-sm" onClick={() => setShowUserModal(true)}>
                    <UserPlus size={14} /> Add User
                  </button>
                </div>
              )}
            </div>

            {/* ADMIN DASHBOARD */}
            {user.role === 'admin' && (
              <>
                <div className="grid-4" style={{ marginBottom: 30 }}>
                  <div className="stat-card">
                    <div className="stat-icon"><Users size={24} /></div>
                    <div>
                      <div className="stat-value">{adminStats?.users ?? usersList.length}</div>
                      <div className="stat-label">Total Users</div>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
                      <GraduationCap size={24} />
                    </div>
                    <div>
                      <div className="stat-value">{adminStats?.students ?? 0}</div>
                      <div className="stat-label">Enrolled Students</div>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
                      <MessageCircleQuestion size={24} />
                    </div>
                    <div>
                      <div className="stat-value">{adminStats?.enquiries ?? enquiries.length}</div>
                      <div className="stat-label">Admissions Enquiries</div>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#f3e8ff', color: '#7e22ce' }}>
                      <CalendarDays size={24} />
                    </div>
                    <div>
                      <div className="stat-value">{adminStats?.batches ?? batches.length}</div>
                      <div className="stat-label">Active Batches</div>
                    </div>
                  </div>
                </div>

                <div className="grid-2">
                  {/* Recent Enquiries */}
                  <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <h3>Recent Admission Enquiries</h3>
                      <button className="button button-light button-sm" onClick={() => go('admissions')}>
                        View All
                      </button>
                    </div>
                    {enquiries.length ? (
                      <table className="data-table">
                        <tbody>
                          {enquiries.slice(0, 5).map(e => (
                            <tr key={e.id}>
                              <td>
                                <strong>{e.name}</strong>
                                <small style={{ display: 'block', color: '#64748b' }}>
                                  Class {e.grade_number} · {e.board} · {e.phone}
                                </small>
                              </td>
                              <td>
                                <span className={`status-pill ${e.status}`}>{e.status}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p style={{ color: '#64748b', fontSize: '0.9rem' }}>No enquiries submitted yet.</p>
                    )}
                  </div>

                  {/* Active Batches */}
                  <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <h3>Coaching Batches</h3>
                      <button className="button button-light button-sm" onClick={() => go('batches')}>
                        Manage
                      </button>
                    </div>
                    {batches.length ? (
                      <table className="data-table">
                        <tbody>
                          {batches.slice(0, 5).map(b => (
                            <tr key={b.id}>
                              <td>
                                <strong>{b.name}</strong>
                                <small style={{ display: 'block', color: '#64748b' }}>{b.schedule_text}</small>
                              </td>
                              <td>
                                <span className="status-pill new">
                                  {b.enrolled_count ?? 0} / {b.capacity} Students
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p style={{ color: '#64748b', fontSize: '0.9rem' }}>No batches created yet.</p>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* FACULTY DASHBOARD */}
            {user.role === 'faculty' && (
              <>
                <div className="grid-4" style={{ marginBottom: 30 }}>
                  <div className="stat-card">
                    <div className="stat-icon"><BookOpen size={24} /></div>
                    <div>
                      <div className="stat-value">{materials.length}</div>
                      <div className="stat-label">Study Materials</div>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
                      <ClipboardCheck size={24} />
                    </div>
                    <div>
                      <div className="stat-value">{tests.length}</div>
                      <div className="stat-label">Published Tests</div>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#fee2e2', color: '#dc2626' }}>
                      <HelpCircle size={24} />
                    </div>
                    <div>
                      <div className="stat-value">
                        {doubts.filter(d => d.status === 'open').length}
                      </div>
                      <div className="stat-label">Pending Doubts</div>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
                      <CalendarDays size={24} />
                    </div>
                    <div>
                      <div className="stat-value">{batches.length}</div>
                      <div className="stat-label">Active Batches</div>
                    </div>
                  </div>
                </div>

                <div className="grid-2">
                  <div className="card">
                    <h3>Quick Actions</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
                      <button className="button button-light" style={{ justifyContent: 'flex-start' }} onClick={() => go('create-material')}>
                        <BookOpen size={18} /> Upload New Study Notes & Worksheets
                      </button>
                      <button className="button button-light" style={{ justifyContent: 'flex-start' }} onClick={() => go('create-test')}>
                        <ClipboardCheck size={18} /> Create Multi-Question Practice Test
                      </button>
                      <button className="button button-light" style={{ justifyContent: 'flex-start' }} onClick={() => go('doubts')}>
                        <HelpCircle size={18} /> Review & Answer Student Questions ({doubts.filter(d => d.status === 'open').length} Open)
                      </button>
                    </div>
                  </div>

                  <div className="card">
                    <h3>Unanswered Student Doubts</h3>
                    <div style={{ marginTop: 14 }}>
                      {doubts.filter(d => d.status === 'open').length ? (
                        doubts.filter(d => d.status === 'open').slice(0, 4).map(d => (
                          <div key={d.id} style={{ padding: '10px 0', borderBottom: '1px solid #e2e8f0' }}>
                            <strong>{d.title}</strong>
                            <p style={{ fontSize: '0.85rem', color: '#64748b' }}>From {d.student_name} ({d.subject_name})</p>
                            <button
                              className="button button-primary button-sm"
                              style={{ marginTop: 6 }}
                              onClick={() => {
                                setActiveDoubtToAnswer(d)
                                setDoubtAnswerText(d.answer_text || '')
                                setShowAnswerModal(true)
                              }}
                            >
                              Answer Now
                            </button>
                          </div>
                        ))
                      ) : (
                        <p style={{ color: '#10b981', fontSize: '0.9rem' }}>
                          🎉 Great job! All student doubts are answered.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* STUDENT DASHBOARD */}
            {user.role === 'student' && (
              <>
                <div className="grid-4" style={{ marginBottom: 30 }}>
                  <div className="stat-card">
                    <div className="stat-icon"><BookOpen size={24} /></div>
                    <div>
                      <div className="stat-value">{materials.length}</div>
                      <div className="stat-label">Available Notes</div>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
                      <ClipboardCheck size={24} />
                    </div>
                    <div>
                      <div className="stat-value">{tests.length}</div>
                      <div className="stat-label">Practice Tests</div>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
                      <Award size={24} />
                    </div>
                    <div>
                      <div className="stat-value">{results.length}</div>
                      <div className="stat-label">Tests Completed</div>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#f3e8ff', color: '#7e22ce' }}>
                      <TrendingUp size={24} />
                    </div>
                    <div>
                      <div className="stat-value">
                        {results.length
                          ? Math.round((results.reduce((s, r) => s + (r.score || 0), 0) / results.reduce((s, r) => s + (r.total_marks || 1), 0)) * 100) + '%'
                          : '—'}
                      </div>
                      <div className="stat-label">Overall Average</div>
                    </div>
                  </div>
                </div>

                {/* Enrolled Batches Card */}
                {studentStats?.enrolled_batches?.length ? (
                  <div className="card" style={{ marginBottom: 24, background: 'linear-gradient(135deg, #eff6ff, #ffffff)', borderColor: '#bfdbfe' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <CalendarDays size={28} color="#1d4ed8" />
                      <div>
                        <h3>My Enrolled Batch</h3>
                        <p style={{ color: '#1e40af', fontWeight: 600, fontSize: '0.95rem' }}>
                          {studentStats.enrolled_batches[0].name}
                        </p>
                        <small style={{ color: '#64748b' }}>
                          Timing: {studentStats.enrolled_batches[0].schedule_text}
                        </small>
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Quick Student Cards */}
                <div className="grid-3">
                  <div className="card" onClick={() => go('materials')} style={{ cursor: 'pointer' }}>
                    <BookOpen size={24} color="#1d4ed8" />
                    <h3 style={{ marginTop: 12 }}>Study Materials</h3>
                    <p style={{ color: '#64748b', fontSize: '0.88rem', marginTop: 6 }}>
                      Access verified chapter notes, formulas, and worksheets.
                    </p>
                  </div>
                  <div className="card" onClick={() => go('tests')} style={{ cursor: 'pointer' }}>
                    <ClipboardCheck size={24} color="#059669" />
                    <h3 style={{ marginTop: 12 }}>Online Tests</h3>
                    <p style={{ color: '#64748b', fontSize: '0.88rem', marginTop: 6 }}>
                      Take timed multiple-choice assessments and check your scores.
                    </p>
                  </div>
                  <div className="card" onClick={() => go('doubts')} style={{ cursor: 'pointer' }}>
                    <HelpCircle size={24} color="#d97706" />
                    <h3 style={{ marginTop: 12 }}>Ask a Doubt</h3>
                    <p style={{ color: '#64748b', fontSize: '0.88rem', marginTop: 6 }}>
                      Send questions directly to faculty and view answered solutions.
                    </p>
                  </div>
                </div>
              </>
            )}
          </section>
        )}

        {/* 6. STUDY MATERIALS LIBRARY */}
        {page === 'materials' && (
          <section className="section">
            <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <span className="eyebrow">DIGITAL REPOSITORY</span>
                <h1>Study Materials & Notes</h1>
                <p>Download chapter notes, formula sheets, NCERT summaries, and worksheets.</p>
              </div>

              {(user?.role === 'admin' || user?.role === 'faculty') && (
                <button className="button button-primary button-sm" onClick={() => go('create-material')}>
                  <Plus size={14} /> Upload Material
                </button>
              )}
            </div>

            {/* Filter Bar */}
            <div className="filter-bar">
              <input
                type="text"
                className="search-input"
                placeholder="Search resources by title or keywords..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              <select
                style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0' }}
                value={filterGrade}
                onChange={e => setFilterGrade(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              >
                <option value="all">All Classes</option>
                <option value={9}>Class 9th</option>
                <option value={10}>Class 10th</option>
                <option value={11}>Class 11th</option>
                <option value={12}>Class 12th</option>
              </select>
              <select
                style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0' }}
                value={filterSubject}
                onChange={e => setFilterSubject(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              >
                <option value="all">All Subjects</option>
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Materials Grid */}
            {filteredMaterials.length ? (
              <div className="grid-2">
                {filteredMaterials.map(m => (
                  <div key={m.id} className="card" style={{ display: 'flex', gap: 16 }}>
                    <div className="stat-icon" style={{ background: '#eff6ff', color: '#1d4ed8' }}>
                      <FileText size={24} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                        <span className="status-pill new">Class {m.grade_number}</span>
                        <span className="status-pill contacted">{m.subject_name}</span>
                        <span className="status-pill closed" style={{ textTransform: 'capitalize' }}>
                          {m.material_type}
                        </span>
                        {!m.is_published && <span className="status-pill open">Draft (Unpublished)</span>}
                      </div>
                      <h3>{m.title}</h3>
                      <p style={{ color: '#64748b', fontSize: '0.88rem', marginTop: 4 }}>{m.description}</p>

                      <div style={{ display: 'flex', gap: 10, marginTop: 16, alignItems: 'center' }}>
                        <a className="button button-light button-sm" href={m.file_url} target="_blank" rel="noreferrer">
                          <ExternalLink size={14} /> Open Document
                        </a>

                        {(user?.role === 'admin' || user?.role === 'faculty') && (
                          <>
                            <button
                              className="button button-sm button-light"
                              onClick={() => toggleMaterial(m.id)}
                            >
                              {m.is_published ? 'Unpublish' : 'Publish'}
                            </button>
                            <button
                              className="button button-sm button-danger"
                              onClick={() => deleteMaterial(m.id)}
                            >
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
                <BookOpen size={48} color="#94a3b8" style={{ margin: '0 auto 12px' }} />
                <h3>No study materials found</h3>
                <p style={{ color: '#64748b' }}>Try clearing your filters or check back later.</p>
              </div>
            )}
          </section>
        )}

        {/* 7. ONLINE TESTS LIST */}
        {page === 'tests' && (
          <section className="section">
            <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <span className="eyebrow">ACADEMIC ASSESSMENTS</span>
                <h1>Practice Tests & Quizzes</h1>
                <p>Timed tests to benchmark your preparation against board exam standards.</p>
              </div>

              {(user?.role === 'admin' || user?.role === 'faculty') && (
                <button className="button button-primary button-sm" onClick={() => go('create-test')}>
                  <Plus size={14} /> Create Test
                </button>
              )}
            </div>

            <div className="grid-2">
              {tests.map(t => (
                <div key={t.id} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                      <span className="status-pill new">Class {t.grade_number}</span>
                      <span className="status-pill contacted">{t.subject_name}</span>
                      {!t.is_published && <span className="status-pill open">Unpublished</span>}
                    </div>
                    <div className="timer-pill" style={{ fontSize: '0.8rem', padding: '4px 10px' }}>
                      <Clock size={13} /> {t.duration_minutes} Mins
                    </div>
                  </div>

                  <h3>{t.title}</h3>
                  <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: 4 }}>{t.description}</p>

                  <div style={{ display: 'flex', gap: 16, margin: '14px 0', fontSize: '0.85rem', color: '#64748b' }}>
                    <span><strong>{t.questions_count ?? t.questions?.length ?? 0}</strong> Questions</span>
                    <span><strong>{t.total_marks}</strong> Marks</span>
                  </div>

                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    {user?.role === 'student' ? (
                      <button className="button button-primary" onClick={() => startTest(t.id)}>
                        Start Test <ArrowRight size={15} />
                      </button>
                    ) : (
                      <>
                        <button className="button button-light button-sm" onClick={() => toggleTest(t.id)}>
                          {t.is_published ? 'Unpublish' : 'Publish'}
                        </button>
                        <button className="button button-danger button-sm" onClick={() => deleteTest(t.id)}>
                          <Trash2 size={13} /> Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 8. ACTIVE TEST TAKING ENGINE */}
        {page === 'take-test' && activeAttempt && (
          <section className="section test-taking-wrapper">
            {/* Sticky Timer Header */}
            <div className="test-sticky-bar">
              <div>
                <strong style={{ fontSize: '1rem', display: 'block' }}>{activeAttempt.test.title}</strong>
                <small style={{ color: '#64748b' }}>
                  Question {currentQIndex + 1} of {activeAttempt.test.questions.length} · {activeAttempt.test.total_marks} Total Marks
                </small>
              </div>
              <div className="timer-pill">
                <Clock size={16} />
                <span>{formatTimer(timeLeft)}</span>
              </div>
            </div>

            {/* Question Navigation Palette */}
            <div className="question-palette">
              {activeAttempt.test.questions.map((_: any, i: number) => (
                <button
                  key={i}
                  className={`palette-btn ${currentQIndex === i ? 'active' : ''} ${answerChoice[i] !== undefined ? 'answered' : ''}`}
                  onClick={() => setCurrentQIndex(i)}
                >
                  {i + 1}
                </button>
              ))}
            </div>

            {/* Current Question Box */}
            <div className="question-box">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <span className="status-pill new">Question {currentQIndex + 1}</span>
                <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>
                  Marks: {activeAttempt.test.questions[currentQIndex].marks ?? 1}
                </span>
              </div>

              <div className="question-prompt">
                {activeAttempt.test.questions[currentQIndex].prompt}
              </div>

              <div>
                {activeAttempt.test.questions[currentQIndex].options.map((opt: string, optIdx: number) => {
                  const isSelected = answerChoice[currentQIndex] === optIdx
                  return (
                    <div
                      key={optIdx}
                      className={`option-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => setAnswerChoice({ ...answerChoice, [currentQIndex]: optIdx })}
                    >
                      <input
                        type="radio"
                        name={`q-${currentQIndex}`}
                        checked={isSelected}
                        onChange={() => setAnswerChoice({ ...answerChoice, [currentQIndex]: optIdx })}
                      />
                      <span><strong>{String.fromCharCode(65 + optIdx)}.</strong> {opt}</span>
                    </div>
                  )
                })}
              </div>

              {/* Prev / Next & Submit */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
                <button
                  className="button button-light"
                  disabled={currentQIndex === 0}
                  onClick={() => setCurrentQIndex(prev => Math.max(0, prev - 1))}
                >
                  Previous
                </button>

                {currentQIndex < activeAttempt.test.questions.length - 1 ? (
                  <button
                    className="button button-primary"
                    onClick={() => setCurrentQIndex(prev => prev + 1)}
                  >
                    Next Question <ArrowRight size={15} />
                  </button>
                ) : (
                  <button
                    className="button button-success"
                    onClick={() => {
                      if (confirm('Are you ready to submit your test for scoring?')) {
                        submitTest()
                      }
                    }}
                  >
                    Submit Test <CheckCircle2 size={16} />
                  </button>
                )}
              </div>
            </div>
          </section>
        )}

        {/* 9. TEST RESULTS & DETAILED REVIEW */}
        {page === 'results' && (
          <section className="section section-narrow">
            <div className="section-header">
              <span className="eyebrow">PERFORMANCE REPORT</span>
              <h1>Test Results & Detailed Review</h1>
              <p>Review your test score, correct answers, and faculty explanations.</p>
            </div>

            {/* Highlighted Review Card */}
            {reviewAttempt && (
              <div className="card" style={{ marginBottom: 30, background: '#f8fafc', border: '2px solid #bfdbfe' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <h2>{reviewAttempt.title}</h2>
                    <small style={{ color: '#64748b' }}>
                      Completed on {reviewAttempt.submitted_at ? new Date(reviewAttempt.submitted_at).toLocaleString() : 'Recently'}
                    </small>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1d4ed8' }}>
                      {reviewAttempt.score} / {reviewAttempt.total_marks}
                    </div>
                    <span className="status-pill admitted">
                      {Math.round((reviewAttempt.score / (reviewAttempt.total_marks || 1)) * 100)}% Accuracy
                    </span>
                  </div>
                </div>

                {/* Question Breakdown List */}
                <h3 style={{ marginTop: 24, marginBottom: 14 }}>Question by Question Review</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {reviewAttempt.breakdown?.map((q: any, i: number) => (
                    <div
                      key={i}
                      style={{
                        padding: 18,
                        borderRadius: 12,
                        background: '#fff',
                        border: `1px solid ${q.is_correct ? '#a7f3d0' : '#fecaca'}`
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <strong>Question {i + 1}</strong>
                        {q.is_correct ? (
                          <span className="status-pill admitted">
                            <CheckCircle2 size={13} /> Correct (+{q.marks} Marks)
                          </span>
                        ) : (
                          <span className="status-pill open">
                            <AlertCircle size={13} /> Incorrect (0 Marks)
                          </span>
                        )}
                      </div>

                      <p style={{ fontWeight: 600, fontSize: '0.98rem', marginBottom: 12 }}>{q.prompt}</p>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.9rem' }}>
                        {q.options.map((opt: string, optI: number) => {
                          const isStudentPick = q.selected_option === optI
                          const isCorrectPick = q.correct_option === optI
                          return (
                            <div
                              key={optI}
                              style={{
                                padding: '8px 12px',
                                borderRadius: 6,
                                background: isCorrectPick
                                  ? '#ecfdf5'
                                  : isStudentPick
                                    ? '#fef2f2'
                                    : '#f8fafc',
                                color: isCorrectPick
                                  ? '#065f46'
                                  : isStudentPick
                                    ? '#991b1b'
                                    : '#334155',
                                fontWeight: isCorrectPick || isStudentPick ? 600 : 400
                              }}
                            >
                              {String.fromCharCode(65 + optI)}. {opt}
                              {isCorrectPick && ' ✅ (Correct Answer)'}
                              {isStudentPick && !isCorrectPick && ' ❌ (Your Choice)'}
                            </div>
                          )
                        })}
                      </div>

                      {q.explanation && (
                        <div style={{ marginTop: 10, padding: '10px 14px', background: '#eff6ff', borderRadius: 8, fontSize: '0.85rem', color: '#1e40af' }}>
                          💡 <strong>Concept Explanation:</strong> {q.explanation}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Past Results Table */}
            <div className="card">
              <h3>Past Attempt History</h3>
              {results.length ? (
                <table className="data-table" style={{ marginTop: 14 }}>
                  <thead>
                    <tr>
                      <th>Test Name</th>
                      <th>Score</th>
                      <th>Submitted Date</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map(r => (
                      <tr key={r.attempt_id}>
                        <td><strong>{r.title}</strong></td>
                        <td>
                          <span className="status-pill new">
                            {r.score} / {r.total_marks} ({Math.round(((r.score || 0) / (r.total_marks || 1)) * 100)}%)
                          </span>
                        </td>
                        <td>{r.submitted_at ? new Date(r.submitted_at).toLocaleDateString() : '—'}</td>
                        <td>
                          <button
                            className="button button-light button-sm"
                            onClick={() => viewAttemptReview(r.attempt_id)}
                          >
                            <Eye size={13} /> Review
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p style={{ color: '#64748b', marginTop: 10 }}>No completed tests yet. Start one from the Online Tests tab!</p>
              )}
            </div>
          </section>
        )}

        {/* 10. DOUBTS RESOLUTION PORTAL */}
        {page === 'doubts' && (
          <section className="section section-narrow">
            <div className="section-header">
              <span className="eyebrow">DOUBT CLEARANCE HUB</span>
              <h1>Ask & Resolve Doubts</h1>
              <p>Get your questions answered by Sunil Sir and expert subject faculties.</p>
            </div>

            {/* Student "Ask a Doubt" Form */}
            {user?.role === 'student' && (
              <form className="form-card" onSubmit={submitDoubt} style={{ marginBottom: 30 }}>
                <h3>Submit a Question</h3>
                <div className="form-group" style={{ marginTop: 14 }}>
                  <label>Subject *</label>
                  <select
                    value={newDoubt.subject_id}
                    onChange={e => setNewDoubt({ ...newDoubt, subject_id: Number(e.target.value) })}
                  >
                    {subjects.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Question Topic / Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. How to balance redox reactions in acidic medium?"
                    value={newDoubt.title}
                    onChange={e => setNewDoubt({ ...newDoubt, title: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Detailed Question Description *</label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Describe exactly where you are stuck, steps you tried, or NCERT question number..."
                    value={newDoubt.question_text}
                    onChange={e => setNewDoubt({ ...newDoubt, question_text: e.target.value })}
                  />
                </div>

                <button className="button button-primary" type="submit" disabled={loading}>
                  {loading ? 'Submitting Doubt...' : 'Ask Faculty'} <ArrowRight size={15} />
                </button>
              </form>
            )}

            {/* List of Doubts */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {doubts.length ? (
                doubts.map(d => (
                  <div key={d.id} className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                          <span className="status-pill contacted">{d.subject_name}</span>
                          <span className={`status-pill ${d.status}`}>{d.status}</span>
                        </div>
                        <h3 style={{ fontSize: '1.1rem' }}>{d.title}</h3>
                        <small style={{ color: '#64748b' }}>
                          Asked by {d.student_name} on {d.created_at ? new Date(d.created_at).toLocaleDateString() : 'Recently'}
                        </small>
                      </div>

                      {(user?.role === 'faculty' || user?.role === 'admin') && (
                        <button
                          className="button button-primary button-sm"
                          onClick={() => {
                            setActiveDoubtToAnswer(d)
                            setDoubtAnswerText(d.answer_text || '')
                            setShowAnswerModal(true)
                          }}
                        >
                          {d.answer_text ? 'Edit Answer' : 'Answer Doubt'}
                        </button>
                      )}
                    </div>

                    <p style={{ background: '#f8fafc', padding: 14, borderRadius: 8, fontSize: '0.92rem', color: '#334155', marginTop: 10 }}>
                      {d.question_text}
                    </p>

                    {/* Answer Block */}
                    {d.answer_text ? (
                      <div style={{ marginTop: 14, padding: 16, background: '#ecfdf5', borderRadius: 8, borderLeft: '4px solid #10b981' }}>
                        <strong style={{ color: '#065f46', display: 'block', marginBottom: 6 }}>
                          👨‍🏫 Faculty Solution:
                        </strong>
                        <p style={{ color: '#047857', fontSize: '0.92rem', whiteSpace: 'pre-line' }}>
                          {d.answer_text}
                        </p>
                      </div>
                    ) : (
                      <div style={{ marginTop: 10, fontSize: '0.85rem', color: '#b45309' }}>
                        ⏳ Waiting for faculty review and response.
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="card" style={{ textAlign: 'center', padding: 36 }}>
                  <HelpCircle size={36} color="#94a3b8" style={{ margin: '0 auto 10px' }} />
                  <h3>No doubts asked yet</h3>
                  <p style={{ color: '#64748b' }}>Ask any concept or problem you are studying.</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* 11. FACULTY: UPLOAD NOTES */}
        {page === 'create-material' && (user?.role === 'faculty' || user?.role === 'admin') && (
          <section className="section section-narrow">
            <div className="section-header">
              <span className="eyebrow">FACULTY TOOLS</span>
              <h1>Publish Study Notes & Worksheets</h1>
              <p>Add study resources for enrolled students across Class 9 to 12.</p>
            </div>

            <form className="form-card" onSubmit={handleCreateMaterial}>
              <div className="form-group">
                <label>Resource Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Class 10 Science: Chemical Reactions Formula & Concepts"
                  value={newMaterial.title}
                  onChange={e => setNewMaterial({ ...newMaterial, title: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Description / Overview</label>
                <textarea
                  rows={3}
                  placeholder="Briefly describe what this note covers..."
                  value={newMaterial.description}
                  onChange={e => setNewMaterial({ ...newMaterial, description: e.target.value })}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Board</label>
                  <select
                    value={newMaterial.board_id}
                    onChange={e => setNewMaterial({ ...newMaterial, board_id: Number(e.target.value) })}
                  >
                    {boards.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Grade Level</label>
                  <select
                    value={newMaterial.grade_id}
                    onChange={e => setNewMaterial({ ...newMaterial, grade_id: Number(e.target.value) })}
                  >
                    {grades.map(g => (
                      <option key={g.id} value={g.id}>{g.display_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Subject</label>
                  <select
                    value={newMaterial.subject_id}
                    onChange={e => setNewMaterial({ ...newMaterial, subject_id: Number(e.target.value) })}
                  >
                    {subjects.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Material Category</label>
                  <select
                    value={newMaterial.material_type}
                    onChange={e => setNewMaterial({ ...newMaterial, material_type: e.target.value })}
                  >
                    <option value="notes">Theory Notes</option>
                    <option value="formula_sheet">Formula Sheet</option>
                    <option value="worksheet">Practice Worksheet</option>
                    <option value="homework">Homework Assignment</option>
                    <option value="revision">Revision Summary</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Document / File Link (URL) *</label>
                <input
                  type="url"
                  required
                  placeholder="https://example.com/notes.pdf"
                  value={newMaterial.file_url}
                  onChange={e => setNewMaterial({ ...newMaterial, file_url: e.target.value })}
                />
              </div>

              <button className="button button-primary" type="submit" style={{ width: '100%' }}>
                Publish Resource <ArrowRight size={16} />
              </button>
            </form>
          </section>
        )}

        {/* 12. FACULTY: CREATE MULTI-QUESTION TEST */}
        {page === 'create-test' && (user?.role === 'faculty' || user?.role === 'admin') && (
          <section className="section section-narrow">
            <div className="section-header">
              <span className="eyebrow">FACULTY TOOLS</span>
              <h1>Build a Multi-Question Assessment</h1>
              <p>Create timed multiple choice tests with custom questions, marks, and explanations.</p>
            </div>

            <form className="form-card" onSubmit={handleCreateTest}>
              <div className="form-group">
                <label>Test Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Class 10 Science: Chemical Reactions Quiz"
                  value={newTest.title}
                  onChange={e => setNewTest({ ...newTest, title: e.target.value })}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Board</label>
                  <select
                    value={newTest.board_id}
                    onChange={e => setNewTest({ ...newTest, board_id: Number(e.target.value) })}
                  >
                    {boards.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Class</label>
                  <select
                    value={newTest.grade_id}
                    onChange={e => setNewTest({ ...newTest, grade_id: Number(e.target.value) })}
                  >
                    {grades.map(g => (
                      <option key={g.id} value={g.id}>{g.display_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Subject</label>
                  <select
                    value={newTest.subject_id}
                    onChange={e => setNewTest({ ...newTest, subject_id: Number(e.target.value) })}
                  >
                    {subjects.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Duration (Minutes)</label>
                  <input
                    type="number"
                    min={5}
                    max={180}
                    value={newTest.duration_minutes}
                    onChange={e => setNewTest({ ...newTest, duration_minutes: Number(e.target.value) })}
                  />
                </div>
              </div>

              {/* Questions List */}
              <div style={{ marginTop: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <h3>Questions ({newTest.questions.length})</h3>
                  <button
                    type="button"
                    className="button button-light button-sm"
                    onClick={() => {
                      setNewTest({
                        ...newTest,
                        questions: [
                          ...newTest.questions,
                          {
                            prompt: '',
                            options: ['Option A', 'Option B', 'Option C', 'Option D'],
                            correct_index: 0,
                            marks: 2,
                            explanation: ''
                          }
                        ]
                      })
                    }}
                  >
                    <Plus size={14} /> Add Another Question
                  </button>
                </div>

                {newTest.questions.map((q, qI) => (
                  <div key={qI} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                      <strong>Question #{qI + 1}</strong>
                      {newTest.questions.length > 1 && (
                        <button
                          type="button"
                          className="button button-danger button-sm"
                          onClick={() => {
                            setNewTest({
                              ...newTest,
                              questions: newTest.questions.filter((_, idx) => idx !== qI)
                            })
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>

                    <div className="form-group">
                      <label>Question Prompt *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Which of the following is an exothermic process?"
                        value={q.prompt}
                        onChange={e => {
                          const updated = [...newTest.questions]
                          updated[qI].prompt = e.target.value
                          setNewTest({ ...newTest, questions: updated })
                        }}
                      />
                    </div>

                    <div className="grid-2">
                      {q.options.map((opt, optI) => (
                        <div key={optI} className="form-group">
                          <label>Option {String.fromCharCode(65 + optI)} *</label>
                          <input
                            type="text"
                            required
                            value={opt}
                            onChange={e => {
                              const updated = [...newTest.questions]
                              updated[qI].options[optI] = e.target.value
                              setNewTest({ ...newTest, questions: updated })
                            }}
                          />
                        </div>
                      ))}
                    </div>

                    <div className="form-row" style={{ marginTop: 10 }}>
                      <div className="form-group">
                        <label>Correct Option *</label>
                        <select
                          value={q.correct_index}
                          onChange={e => {
                            const updated = [...newTest.questions]
                            updated[qI].correct_index = Number(e.target.value)
                            setNewTest({ ...newTest, questions: updated })
                          }}
                        >
                          {q.options.map((opt, optI) => (
                            <option key={optI} value={optI}>
                              Option {String.fromCharCode(65 + optI)} ({opt || 'Option ' + (optI + 1)})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Marks for this Question</label>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={q.marks}
                          onChange={e => {
                            const updated = [...newTest.questions]
                            updated[qI].marks = Number(e.target.value)
                            setNewTest({ ...newTest, questions: updated })
                          }}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Concept Explanation (Shown to students after submission)</label>
                      <input
                        type="text"
                        placeholder="Why is this the correct answer?"
                        value={q.explanation}
                        onChange={e => {
                          const updated = [...newTest.questions]
                          updated[qI].explanation = e.target.value
                          setNewTest({ ...newTest, questions: updated })
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <button className="button button-primary" type="submit" style={{ width: '100%', marginTop: 10 }}>
                Publish Assessment ({newTest.questions.length} Questions) <ArrowRight size={16} />
              </button>
            </form>
          </section>
        )}

        {/* 13. ADMIN: ADMISSION ENQUIRIES */}
        {page === 'admissions' && user?.role === 'admin' && (
          <section className="section">
            <div className="section-header">
              <span className="eyebrow">ADMINISTRATION</span>
              <h1>Admission Enquiries Pipeline</h1>
              <p>Manage and track prospective student admissions enquiries.</p>
            </div>

            {/* Filter */}
            <div className="filter-bar">
              {['all', 'new', 'contacted', 'admitted', 'closed'].map(st => (
                <button
                  key={st}
                  className={`tab-btn ${enquiryStatusFilter === st ? 'active' : ''}`}
                  onClick={() => setEnquiryStatusFilter(st)}
                  style={{ textTransform: 'capitalize' }}
                >
                  {st} Enquiries
                </button>
              ))}
            </div>

            <div className="card">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Student Name</th>
                    <th>Contact Details</th>
                    <th>Board & Class</th>
                    <th>Message</th>
                    <th>Status</th>
                    <th>Update Status</th>
                  </tr>
                </thead>
                <tbody>
                  {enquiries
                    .filter(e => enquiryStatusFilter === 'all' || e.status === enquiryStatusFilter)
                    .map(e => (
                      <tr key={e.id}>
                        <td><strong>{e.name}</strong></td>
                        <td>
                          <div>{e.phone}</div>
                          <small style={{ color: '#64748b' }}>{e.email || 'No email'}</small>
                        </td>
                        <td>
                          <span className="status-pill new">{e.board}</span> Class {e.grade_number}
                        </td>
                        <td style={{ maxWidth: 280, fontSize: '0.85rem', color: '#64748b' }}>
                          {e.message || '—'}
                        </td>
                        <td>
                          <span className={`status-pill ${e.status}`}>{e.status}</span>
                        </td>
                        <td>
                          <select
                            style={{ padding: '4px 8px', borderRadius: 6, fontSize: '0.8rem' }}
                            value={e.status}
                            onChange={evt => updateEnquiryStatus(e.id, evt.target.value)}
                          >
                            <option value="new">New</option>
                            <option value="contacted">Contacted</option>
                            <option value="admitted">Admitted</option>
                            <option value="closed">Closed</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* 14. ADMIN: BATCHES & ENROLLMENTS */}
        {page === 'batches' && (user?.role === 'admin' || user?.role === 'faculty') && (
          <section className="section">
            <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <span className="eyebrow">ACADEMIC MANAGEMENT</span>
                <h1>Batches & Student Enrollments</h1>
                <p>Manage classroom schedules, seat capacities, and student assignments.</p>
              </div>

              {user?.role === 'admin' && (
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="button button-primary button-sm" onClick={() => setShowBatchModal(true)}>
                    <Plus size={14} /> Create Batch
                  </button>
                  <button className="button button-light button-sm" onClick={() => setShowEnrollModal(true)}>
                    <UserPlus size={14} /> Enroll Student
                  </button>
                </div>
              )}
            </div>

            <div className="grid-2">
              {batches.map(b => (
                <div key={b.id} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span className="status-pill new">{b.board_name} · {b.grade_display}</span>
                    <span className="status-pill admitted">
                      {b.enrolled_count ?? 0} / {b.capacity} Seats Filled
                    </span>
                  </div>

                  <h3 style={{ marginTop: 10 }}>{b.name}</h3>
                  <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: 4 }}>
                    Schedule: {b.schedule_text || 'Regular Timings'}
                  </p>

                  {/* Capacity Bar */}
                  <div style={{ margin: '14px 0 6px', background: '#e2e8f0', borderRadius: 9999, height: 8, overflow: 'hidden' }}>
                    <div
                      style={{
                        background: '#1d4ed8',
                        height: '100%',
                        width: `${Math.min(100, Math.round(((b.enrolled_count || 0) / b.capacity) * 100))}%`
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
                    <small style={{ color: '#64748b', fontSize: '0.78rem' }}>
                      Academic Year: {b.academic_year || '2026-27'} · Mode: Offline Classroom
                    </small>
                    {user?.role === 'admin' && (
                      <button
                        className="button button-light button-sm"
                        onClick={() => {
                          setEnrollForm(prev => ({ ...prev, batch_id: b.id }))
                          setShowEnrollModal(true)
                        }}
                      >
                        <UserPlus size={13} /> Enroll Student
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 15. ADMIN: USER MANAGEMENT */}
        {page === 'users' && user?.role === 'admin' && (
          <section className="section">
            <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <span className="eyebrow">SYSTEM USERS</span>
                <h1>User Account Directory</h1>
                <p>Manage credentials and portal access for students, faculties, and administrators.</p>
              </div>

              <button className="button button-primary button-sm" onClick={() => setShowUserModal(true)}>
                <UserPlus size={14} /> Add New User
              </button>
            </div>

            <div className="card">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Phone</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {usersList.map(u => (
                    <tr key={u.id}>
                      <td><strong>{u.full_name}</strong></td>
                      <td>{u.email}</td>
                      <td>
                        <span className={`role-tag ${u.role}`}>{u.role}</span>
                      </td>
                      <td>{u.phone || '—'}</td>
                      <td>
                        <span className={`status-pill ${u.is_active ? 'admitted' : 'closed'}`}>
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        {u.id !== user.id && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              className="button button-light button-sm"
                              onClick={() => toggleUserStatus(u.id)}
                            >
                              {u.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                            <button
                              className="button button-danger button-sm"
                              onClick={() => deleteUser(u.id, u.full_name)}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>

      {/* MODAL: ANSWER DOUBT */}
      {showAnswerModal && activeDoubtToAnswer && (
        <div className="modal-backdrop" onClick={() => setShowAnswerModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Answer Student Doubt</h3>
              <button className="button button-light button-sm" onClick={() => setShowAnswerModal(false)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <span className="status-pill contacted">{activeDoubtToAnswer.subject_name}</span>
              <h4 style={{ marginTop: 8 }}>{activeDoubtToAnswer.title}</h4>
              <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: 4 }}>
                Asked by {activeDoubtToAnswer.student_name}: {activeDoubtToAnswer.question_text}
              </p>
            </div>

            <form onSubmit={submitDoubtAnswer}>
              <div className="form-group">
                <label>Faculty Explanation & Solution *</label>
                <textarea
                  rows={5}
                  required
                  placeholder="Provide step-by-step guidance, formula derivations, or key insights..."
                  value={doubtAnswerText}
                  onChange={e => setDoubtAnswerText(e.target.value)}
                />
              </div>

              <button className="button button-primary" type="submit" style={{ width: '100%' }}>
                Publish Answer to Student <CheckCircle2 size={15} />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE BATCH */}
      {showBatchModal && (
        <div className="modal-backdrop" onClick={() => setShowBatchModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create Coaching Batch</h3>
              <button className="button button-light button-sm" onClick={() => setShowBatchModal(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateBatch}>
              <div className="form-group">
                <label>Batch Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CBSE Class 10 Morning Achievers"
                  value={newBatch.name}
                  onChange={e => setNewBatch({ ...newBatch, name: e.target.value })}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Board</label>
                  <select
                    value={newBatch.board_id}
                    onChange={e => setNewBatch({ ...newBatch, board_id: Number(e.target.value) })}
                  >
                    {boards.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Grade Level</label>
                  <select
                    value={newBatch.grade_id}
                    onChange={e => setNewBatch({ ...newBatch, grade_id: Number(e.target.value) })}
                  >
                    {grades.map(g => (
                      <option key={g.id} value={g.id}>{g.display_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Academic Year</label>
                  <select
                    value={newBatch.academic_year_id}
                    onChange={e => setNewBatch({ ...newBatch, academic_year_id: Number(e.target.value) })}
                  >
                    {academicYears.map(y => (
                      <option key={y.id} value={y.id}>{y.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Seat Capacity</label>
                  <input
                    type="number"
                    min={5}
                    max={120}
                    value={newBatch.capacity}
                    onChange={e => setNewBatch({ ...newBatch, capacity: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Schedule / Timings</label>
                <input
                  type="text"
                  placeholder="e.g. Mon-Sat · 07:00 AM - 09:00 AM"
                  value={newBatch.schedule_text}
                  onChange={e => setNewBatch({ ...newBatch, schedule_text: e.target.value })}
                />
              </div>

              <button className="button button-primary" type="submit" style={{ width: '100%' }}>
                Create Batch <CheckCircle2 size={15} />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ENROLL STUDENT */}
      {showEnrollModal && (
        <div className="modal-backdrop" onClick={() => setShowEnrollModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Enroll Student into Batch</h3>
              <button className="button button-light button-sm" onClick={() => setShowEnrollModal(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleEnrollStudent}>
              <div className="form-group">
                <label>Select Student *</label>
                <select
                  value={enrollForm.student_id}
                  onChange={e => setEnrollForm({ ...enrollForm, student_id: Number(e.target.value) })}
                  required
                >
                  <option value={0}>Choose a student...</option>
                  {usersList
                    .filter(u => u.role === 'student')
                    .map(s => (
                      <option key={s.id} value={s.id}>{s.full_name} ({s.email})</option>
                    ))}
                </select>
              </div>

              <div className="form-group">
                <label>Select Batch *</label>
                <select
                  value={enrollForm.batch_id}
                  onChange={e => setEnrollForm({ ...enrollForm, batch_id: Number(e.target.value) })}
                  required
                >
                  <option value={0}>Choose a batch...</option>
                  {batches.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.enrolled_count ?? 0}/{b.capacity} seats)
                    </option>
                  ))}
                </select>
              </div>

              <button
                className="button button-primary"
                type="submit"
                disabled={!enrollForm.student_id || !enrollForm.batch_id}
                style={{ width: '100%' }}
              >
                Confirm Enrollment <CheckCircle2 size={15} />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE USER */}
      {showUserModal && (
        <div className="modal-backdrop" onClick={() => setShowUserModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create User Account</h3>
              <button className="button button-light button-sm" onClick={() => setShowUserModal(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateUser}>
              <div className="form-group">
                <label>Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Er. Neeraj Verma"
                  value={newUser.full_name}
                  onChange={e => setNewUser({ ...newUser, full_name: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="neeraj@example.com"
                  value={newUser.email}
                  onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Role *</label>
                  <select
                    value={newUser.role}
                    onChange={e => setNewUser({ ...newUser, role: e.target.value as any })}
                  >
                    <option value="student">Student</option>
                    <option value="faculty">Faculty</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Phone Number</label>
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={newUser.phone}
                    onChange={e => setNewUser({ ...newUser, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Initial Password (min 6 characters) *</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Enter initial password"
                  value={newUser.password}
                  onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                />
              </div>

              <button className="button button-primary" type="submit" style={{ width: '100%' }}>
                Create Account <CheckCircle2 size={15} />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="footer">
        <div className="footer-top">
          <div style={{ maxWidth: 360 }}>
            <div className="brand" style={{ marginBottom: 12 }}>
              <span className="brand-mark"><GraduationCap size={22} /></span>
              <span className="brand-title">SUNIL SIR CLASSES</span>
            </div>
            <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.6 }}>
              Dedicated offline coaching with comprehensive digital study resources and assessments
              for CBSE and UP Board students of Classes 9th, 10th, 11th, and 12th.
            </p>
          </div>

          <div>
            <h4 style={{ marginBottom: 12 }}>Academic Programs</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.88rem', color: '#64748b' }}>
              <span>CBSE Class 10th Board Target</span>
              <span>CBSE Class 12th Science Stream</span>
              <span>UP Board High School & Intermediate</span>
              <span>Class 9th High School Foundation</span>
            </div>
          </div>

          <div>
            <h4 style={{ marginBottom: 12 }}>Portals & Support</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.88rem', color: '#64748b' }}>
              <a href="#" onClick={e => { e.preventDefault(); go('login') }}>Student & Faculty Portal</a>
              <a href="#" onClick={e => { e.preventDefault(); go('admission') }}>Admission Enquiry</a>
              <a href="#" onClick={e => { e.preventDefault(); demoLogin('student') }}>Demo Student Access</a>
              <a href="#" onClick={e => { e.preventDefault(); demoLogin('faculty') }}>Demo Faculty Access</a>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Sunil Sir Classes. All rights reserved.</span>
          <span>Designed with high standards for CBSE & UP Board educational excellence.</span>
        </div>
      </footer>
    </div>
  )
}
