// Auth types
export interface User {
  id: string;
  email: string;
  fullName: string;
  onboardingComplete?: boolean;
  role: 'Student' | 'Teacher' | 'School Admin' | 'Guardian';
}

export interface AuthResponse {
  learnerId: string;
  email: string;
  fullName?: string | null;
  onboardingComplete: boolean;
  message: string;
}

// Onboarding types
export interface ProfileData {
  preferredLanguage: string;
  ageGroup: string;
  learningGoal: string;
}

export interface PlacementData {
  score: number;
  totalQuestions: number;
}

export interface GuardianLinkData {
  fullName: string;
  relationship: string;
  phone?: string;
  email?: string;
}

// Content types
export interface UploadTextData {
  text: string;
  subject?: string;
}

export interface Lesson {
  id: string;
  title: string;
  sections: Section[];
  keyTerms: KeyTerm[];
}

export interface Section {
  id: string;
  heading: string;
  body: string;
  order: number;
}

export interface KeyTerm {
  id: string;
  term: string;
  definition: string;
}

export interface SectionProgressData {
  additionalSeconds: number;
}

export interface TermTapData {
  termId: string;
}

// Quiz types
export interface QuizStartResponse {
  quizId: string;
  totalQuestions: number;
  firstQuestion: Question;
}

export interface Question {
  id: string;
  text: string;
  options: Option[];
}

export interface Option {
  id: string; // 'a', 'b', 'c', 'd'
  text: string;
}

export interface QuizAnswerData {
  questionId: string;
  selectedOptionId: string; // 'a', 'b', 'c', 'd'
  latencyMs: number;
}

export interface QuizAnswerResponse {
  isCorrect: boolean;
  learnerMessage: string;
  nextQuestion?: Question;
  quizComplete: boolean;
  re_explanation?: string;
  reattempt_question?: Question;
}

export interface QuizCompleteResponse {
  scorePercentage: number;
  correctCount: number;
  totalQuestions: number;
  summaryMessage: string;
}

// Progress types
export interface DashboardData {
  lessonsCompleted: number;
  avgQuizScore: number;
  recentLessons: LessonSummary[];
  quizHistory: QuizHistory[];
}

export interface LessonSummary {
  id: string;
  title: string;
  completedAt: string;
  score?: number;
}

export interface QuizHistory {
  id: string;
  lessonTitle: string;
  score: number;
  completedAt: string;
}

export interface Document {
  id: string;
  title: string;
  uploadedAt: string;
  actions?: string[];
  summary?: string;
  fileType?: string;
  status?: 'Processed' | 'In Review';
}
