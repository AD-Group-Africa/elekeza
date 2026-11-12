import { describe, expect, it } from 'vitest';
import type { Gamification } from '@/features/learner/api';
import { celebrationFor } from './celebration';

const game = (over: Partial<Gamification> = {}): Gamification => ({
  level: 1,
  levelName: 'Seed',
  points: 20,
  nextLevelPoints: 30,
  stars: 3,
  achievements: ['First Steps'],
  ...over,
});

describe('celebrationFor', () => {
  it('announces only badges earned by this quiz', () => {
    const before = game({ achievements: ['First Steps', 'On Fire'] });
    const after = game({ points: 32, achievements: ['First Steps', 'On Fire', 'Quiz Explorer'] });
    expect(celebrationFor(80, after, before).newAchievements).toEqual(['Quiz Explorer']);
  });

  it('announces no badges when nothing new was earned', () => {
    const before = game({ achievements: ['First Steps', 'On Fire'] });
    const after = game({ points: 32, achievements: ['First Steps', 'On Fire'] });
    expect(celebrationFor(80, after, before).newAchievements).toEqual([]);
  });

  it('reports the real XP gained and a level-up', () => {
    const before = game({ points: 44 });
    const after = game({ points: 56, level: 2, levelName: 'Sprout' });
    const data = celebrationFor(95, after, before);
    expect(data.xpEarned).toBe(12);
    expect(data.levelUp).toEqual({ level: 2, levelName: 'Sprout' });
    expect(data.stars).toBe(5);
  });

  it('falls back safely without a before snapshot', () => {
    const data = celebrationFor(50, game({ achievements: ['First Steps', 'On Fire'] }));
    expect(data.xpEarned).toBe(10);
    expect(data.newAchievements).toEqual([]);
    expect(data.levelUp).toBeNull();
  });
});
