import type { Level, LevelStats, LessonAnswer, UserProgress, Word, WordProgress } from '../types';

export const LEVELS: Level[] = ['A2', 'B1'];
const MP3_VOICE_SET = new Set(['aoede', 'charon', 'standard-b']);

export function createEmptyLevelProgress(): LevelStats {
  return {
    completedLessons: 0,
    totalCorrect: 0,
    totalWrong: 0,
  };
}

function normalizeWordProgress(word: WordProgress | undefined): WordProgress {
  const normalizedLastSeenAt =
    typeof word?.lastSeenAt === 'string' ? Date.parse(word.lastSeenAt) : word?.lastSeenAt;

  return {
    correct: word?.correct ?? 0,
    wrong: word?.wrong ?? 0,
    streak: word?.streak ?? 0,
    learnedByChoice: word?.learnedByChoice ?? false,
    lastSeenAt: Number.isFinite(normalizedLastSeenAt) ? normalizedLastSeenAt : undefined,
  };
}

function normalizeLevelProgress(level: Partial<LevelStats> | undefined): LevelStats {
  return {
    ...createEmptyLevelProgress(),
    ...level,
  };
}

export function isWordLearned(word: WordProgress | undefined): boolean {
  if (!word) {
    return false;
  }

  if (word.learnedByChoice) {
    return true;
  }

  return word.streak >= 2;
}

export function createDefaultProgress(): UserProgress {
  return {
    settings: {
      currentLevel: 'A2',
      nativeLanguage: 'en',
      hasCompletedOnboarding: false,
      autoPlayAudio: true,
      audioMode: 'mp3',
      audioVoice: 'standard-b',
    },
    words: {},
    levels: {
      A2: createEmptyLevelProgress(),
      B1: createEmptyLevelProgress(),
    },
  };
}

export function mergeProgress(rawValue: Partial<UserProgress> | null | undefined): UserProgress {
  const base = createDefaultProgress();

  if (!rawValue) {
    return base;
  }

  const normalizedWords = Object.fromEntries(
    Object.entries(rawValue.words ?? {}).map(([wordId, word]) => [wordId, normalizeWordProgress(word)]),
  );

  return {
    settings: {
      currentLevel: rawValue.settings?.currentLevel === 'B1' ? 'B1' : base.settings.currentLevel,
      nativeLanguage: rawValue.settings?.nativeLanguage ?? base.settings.nativeLanguage,
      hasCompletedOnboarding: rawValue.settings?.hasCompletedOnboarding ?? base.settings.hasCompletedOnboarding,
      autoPlayAudio: rawValue.settings?.autoPlayAudio ?? base.settings.autoPlayAudio,
      audioMode: rawValue.settings?.audioMode === 'tts' ? 'tts' : base.settings.audioMode,
      audioVoice: MP3_VOICE_SET.has(rawValue.settings?.audioVoice ?? '')
        ? rawValue.settings!.audioVoice
        : base.settings.audioVoice,
    },
    words: normalizedWords,
    levels: {
      A2: normalizeLevelProgress(rawValue.levels?.A2),
      B1: normalizeLevelProgress(rawValue.levels?.B1),
    },
  };
}

export function applyLessonAnswers(previous: UserProgress, level: Level, answers: LessonAnswer[]): UserProgress {
  const currentLevel = previous.levels[level];
  const nextWords = { ...previous.words };
  let correctCount = 0;
  let wrongCount = 0;

  for (const answer of answers) {
    const existing = normalizeWordProgress(nextWords[answer.question.wordId]);

    if (answer.outcome === 'correct') {
      correctCount += 1;
      nextWords[answer.question.wordId] = {
        ...existing,
        correct: existing.correct + 1,
        streak: existing.streak + 1,
        lastSeenAt: Date.now(),
      };
    } else if (answer.outcome === 'wrong' || answer.outcome === 'dont_know') {
      wrongCount += 1;
      nextWords[answer.question.wordId] = {
        ...existing,
        wrong: existing.wrong + 1,
        streak: 0,
        lastSeenAt: Date.now(),
      };
    } else if (answer.outcome === 'know_it') {
      nextWords[answer.question.wordId] = {
        ...existing,
        streak: Math.max(existing.streak, 2),
        learnedByChoice: true,
        lastSeenAt: Date.now(),
      };
    }
  }

  return {
    ...previous,
    words: nextWords,
    levels: {
      ...previous.levels,
      [level]: {
        ...currentLevel,
        completedLessons: currentLevel.completedLessons + 1,
        totalCorrect: currentLevel.totalCorrect + correctCount,
        totalWrong: currentLevel.totalWrong + wrongCount,
        lastStudiedAt: new Date().toISOString(),
      },
    },
  };
}

export function getMasteredWordCount(wordsProgress: Record<string, WordProgress>, words?: Word[]): number {
  if (!words) {
    return Object.values(wordsProgress).filter((word) => isWordLearned(word)).length;
  }

  return words.filter((word) => isWordLearned(wordsProgress[word.id])).length;
}

export function getWeakWordIds(wordsProgress: Record<string, WordProgress>, words?: Word[]): string[] {
  if (!words) {
    return Object.entries(wordsProgress)
      .filter(([, word]) => !isWordLearned(word))
      .map(([wordId]) => wordId);
  }

  return words
    .filter((word) => {
      const progress = wordsProgress[word.id];
      return Boolean(progress) && !isWordLearned(progress);
    })
    .map((word) => word.id);
}
