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
  content: string;
  timeSpentSeconds?: number;
  heading?: string;
  body?: string;
  order?: number;
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
  quizId?: string;
  scorePercentage: number;
  correctCount: number;
  totalQuestions: number;
  summaryMessage: string;
  failedQuestions?: FailedQuestionReview[];
}

export interface FailedQuestionReview {
  questionId: string;
  questionText: string;
  selectedOptionId?: string | null;
  selectedAnswerText?: string | null;
  correctOptionId: string;
  correctAnswerText?: string | null;
}

// Progress types
export interface DashboardData {
  lessonsCompleted: number;
  avgQuizScore: number;
  recentLessons: LessonSummary[];
  quizHistory: QuizHistory[];
}

export interface LessonSummary {
  lessonId: string;
  title: string;
  createdAt: string;
  estimatedMinutes?: number;
}

export interface QuizHistory {
  quizId: string;
  lessonTitle: string;
  scorePercentage: number;
  completedAt?: string | null;
}

export interface LessonHistoryItem {
  id: string;
  title: string;
  sourceType: string;
  createdAt: string;
  summary: string;
}

export interface Document {
  id: string;
  title: string;
  uploadedAt: string;
  href?: string;
  actions?: string[];
  summary?: string;
  fileType?: string;
  status?: 'Processed' | 'In Review';
}
