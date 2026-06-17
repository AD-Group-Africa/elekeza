'use client';

import { useEffect, useState } from 'react';
import { openDB } from 'idb';

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const setOnline = () => setIsOnline(true);
    const setOffline = () => setIsOnline(false);
    window.addEventListener('online', setOnline);
    window.addEventListener('offline', setOffline);
    return () => {
      window.removeEventListener('online', setOnline);
      window.removeEventListener('offline', setOffline);
    };
  }, []);

  const queueAnswer = async (quizId: string, questionId: string, selectedOptionId: string) => {
    const db = await openDB('elekeza-offline', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('sync-queue')) {
          db.createObjectStore('sync-queue', { keyPath: 'id', autoIncrement: true });
        }
      },
    });
    db.add('sync-queue', {
      quizId,
      questionId,
      selectedOptionId,
      timestamp: Date.now(),
      type: questionId === 'complete' ? 'quiz-complete' : 'quiz-answer',
    });
  };

  return { isOnline, queueAnswer };
}
