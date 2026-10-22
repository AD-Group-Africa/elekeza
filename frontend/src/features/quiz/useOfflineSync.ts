'use client';

import { useCallback, useEffect, useState } from 'react';
import { openDB } from 'idb';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { quizApi } from './api';

type QueuedAction = {
  id: string;
  quizId: string;
  questionId: string;
  selectedOptionId: string;
  createdAt: string;
  attempts: number;
};

const DB_NAME = 'elekeza-offline';
const STORE_NAME = 'sync-queue';

async function queueDb() {
  return openDB(DB_NAME, 2, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    },
  });
}

export function useOfflineSync() {
  const isOnline = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const [syncError, setSyncError] = useState<string | null>(null);

  const refreshPendingCount = useCallback(async () => {
    const db = await queueDb();
    setPendingCount(await db.count(STORE_NAME));
  }, []);

  const flushQueue = useCallback(async () => {
    if (!navigator.onLine) return;
    const db = await queueDb();
    const actions = (await db.getAll(STORE_NAME)) as QueuedAction[];
    for (const action of actions) {
      try {
        // The backend parses questionId as a Number — a string here would
        // 400 on flush and strand the queue forever. The idempotency key
        // makes a retried flush safe.
        await quizApi.answer(action.quizId, Number(action.questionId), action.selectedOptionId, undefined, action.id);
        await db.delete(STORE_NAME, action.id);
      } catch {
        await db.put(STORE_NAME, { ...action, attempts: action.attempts + 1 });
        setSyncError('Some learning activity could not be synchronized. It will retry when connectivity returns.');
        break;
      }
    }
    await refreshPendingCount();
  }, [refreshPendingCount]);

  useEffect(() => {
    const online = () => {
      void flushQueue();
    };
    window.addEventListener('online', online);
    const init = async () => {
      await refreshPendingCount();
      if (navigator.onLine) await flushQueue();
    };
    void init();
    return () => {
      window.removeEventListener('online', online);
    };
  }, [flushQueue, refreshPendingCount]);

  const queueAnswer = useCallback(
    async (quizId: string, questionId: string, selectedOptionId: string) => {
      const db = await queueDb();
      const action: QueuedAction = {
        id: crypto.randomUUID(),
        quizId,
        questionId,
        selectedOptionId,
        createdAt: new Date().toISOString(),
        attempts: 0,
      };
      await db.put(STORE_NAME, action);
      await refreshPendingCount();
      if (navigator.onLine) await flushQueue();
      return action.id;
    },
    [flushQueue, refreshPendingCount],
  );

  return { isOnline, pendingCount, syncError, queueAnswer, flushQueue };
}
