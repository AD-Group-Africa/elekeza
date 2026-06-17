'use client';

import { useState } from 'react';

const DEMO_LESSON = {
  title: 'The Water Cycle',
  sections: [
    { heading: 'What is the Water Cycle?', body: 'The water cycle is the way water moves around the Earth. Water changes form as it moves. The sun makes this happen.' },
    { heading: 'Step 1: Evaporation', body: 'The sun heats water in oceans, lakes, and rivers. The water turns into vapor. Vapor is a gas. It goes up into the air.' },
    { heading: 'Step 2: Condensation', body: 'The vapor cools down high in the sky. It turns back into tiny water drops. These drops make clouds.' },
    { heading: 'Step 3: Precipitation', body: 'When clouds are full of water, the water falls. It can fall as rain. If it is cold, it falls as snow or hail.' },
    { heading: 'Step 4: Collection', body: 'The water flows back to oceans, lakes, and rivers. Then the cycle starts again. This happens over and over.' }
  ]
};

const DEMO_QUIZ = {
  questions: [
    { id: 'q1', questionText: 'What makes the water cycle happen?', options: ['The moon', 'The sun', 'The wind', 'The rain'], correctOptionId: '1' },
    { id: 'q2', questionText: 'What is it called when water turns into vapor?', options: ['Condensation', 'Precipitation', 'Evaporation', 'Collection'], correctOptionId: '2' },
    { id: 'q3', questionText: 'What makes clouds?', options: ['Big water drops', 'Tiny water drops', 'Smoke', 'Dust'], correctOptionId: '1' },
    { id: 'q4', questionText: 'What can fall from clouds when it is cold?', options: ['Rain only', 'Snow or hail', 'Vapor', 'Sunlight'], correctOptionId: '1' },
    { id: 'q5', questionText: 'Where does water go after it falls?', options: ['It stays on the ground', 'It goes back to oceans', 'It disappears', 'It turns into rocks'], correctOptionId: '1' }
  ]
};

export default function DemoLessonPage() {
  const [step, setStep] = useState<'reading' | 'quiz' | 'result'>('reading');
  const [currentSection, setCurrentSection] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [score, setScore] = useState(0);

  const finishReading = () => setStep('quiz');

  const handleAnswer = (optionId: string) => {
    const newAnswers = { ...answers, [DEMO_QUIZ.questions[currentQuestion].id]: optionId };
    setAnswers(newAnswers);
    if (currentQuestion < DEMO_QUIZ.questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      let correct = 0;
      DEMO_QUIZ.questions.forEach(q => {
        if (newAnswers[q.id] === q.correctOptionId) correct++;
      });
      const finalScore = Math.round((correct / DEMO_QUIZ.questions.length) * 100);
      setScore(finalScore);
      setStep('result');
      const progress = JSON.parse(localStorage.getItem('elekeza-progress') || '{}');
      progress['demo-lesson'] = { completed: true, score: finalScore, date: new Date().toISOString() };
      localStorage.setItem('elekeza-progress', JSON.stringify(progress));
    }
  };

  return (
    <main className="min-h-screen bg-white p-6 max-w-2xl mx-auto" role="main" aria-label="Lesson content">
      <h1 className="text-3xl font-bold text-blue-900 mb-6">{DEMO_LESSON.title}</h1>

      {step === 'reading' && (
        <>
          <div className="bg-blue-50 rounded-2xl p-6 shadow mb-6">
            <h2 className="text-xl font-semibold text-blue-900 mb-2">{DEMO_LESSON.sections[currentSection].heading}</h2>
            <p className="text-lg leading-relaxed text-gray-800">{DEMO_LESSON.sections[currentSection].body}</p>
            <button
              onClick={() => {
                const utterance = new SpeechSynthesisUtterance(DEMO_LESSON.sections[currentSection].body);
                utterance.rate = 0.85;
                speechSynthesis.speak(utterance);
              }}
              className="mt-4 text-indigo-500 underline font-medium"
            >
              🔊 Listen
            </button>
          </div>
          <div className="flex gap-3">
            {currentSection > 0 && (
              <button onClick={() => setCurrentSection(currentSection - 1)} className="px-5 py-2 bg-gray-200 rounded-full text-gray-700">Previous</button>
            )}
            {currentSection < DEMO_LESSON.sections.length - 1 ? (
              <button onClick={() => setCurrentSection(currentSection + 1)} className="px-5 py-2 bg-indigo-500 text-white rounded-full">Next</button>
            ) : (
              <button onClick={finishReading} className="px-5 py-2 bg-orange-500 text-white rounded-full">Take Quiz</button>
            )}
          </div>
        </>
      )}

      {step === 'quiz' && (
        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-lg font-semibold text-blue-900 mb-4">Question {currentQuestion + 1} of {DEMO_QUIZ.questions.length}</h2>
          <p className="text-xl mb-6">{DEMO_QUIZ.questions[currentQuestion].questionText}</p>
          <div className="space-y-3">
            {DEMO_QUIZ.questions[currentQuestion].options.map((opt, idx) => (
              <button
                key={idx}
                onClick={() => handleAnswer(String(idx))}
                className="block w-full text-left p-4 border border-gray-200 rounded-xl hover:bg-blue-50 transition"
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 'result' && (
        <div className="bg-white rounded-2xl shadow p-8 text-center">
          <div className="text-5xl font-bold text-indigo-500 mb-4">{score}%</div>
          <p className="text-xl mb-8 text-gray-700">Great job completing the lesson!</p>
          <button onClick={() => window.location.href = '/student-home'} className="px-6 py-3 bg-indigo-500 text-white rounded-full">
            Back to Home
          </button>
        </div>
      )}
    </main>
  );
}
