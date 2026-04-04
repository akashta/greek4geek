import type {
  LanguageCode,
  LessonGroupId,
  LessonQuestion,
  LessonSession,
  Level,
  NativeLanguage,
  UserProgress,
  Word,
} from '../types';
import { getWeakWordIds } from './progress';
import { getWordLabel } from './words';

const LESSON_WORD_COUNT = 10;
const RECENT_WORD_COOLDOWN_MS = 1000 * 60 * 60;

function shuffle<T>(items: T[]): T[] {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function startsWithUppercase(text: string): boolean {
  const firstCharacter = text.trim().charAt(0);
  return firstCharacter.length > 0 && firstCharacter === firstCharacter.toLocaleUpperCase();
}

function getWordScore(wordProgress: UserProgress['words'][string] | undefined): number {
  return (wordProgress?.correct ?? 0) - (wordProgress?.wrong ?? 0);
}

function getLastSeenAt(wordProgress: UserProgress['words'][string] | undefined): number {
  return wordProgress?.lastSeenAt ?? 0;
}

function isOnCooldown(wordProgress: UserProgress['words'][string] | undefined, now: number): boolean {
  if (!wordProgress?.lastSeenAt) {
    return false;
  }

  return now - wordProgress.lastSeenAt < RECENT_WORD_COOLDOWN_MS;
}

function sortWordsForLesson(words: Word[], progress: UserProgress): Word[] {
  return shuffle(words).sort((left, right) => {
    const leftProgress = progress.words[left.id];
    const rightProgress = progress.words[right.id];
    const leftLastSeenAt = getLastSeenAt(leftProgress);
    const rightLastSeenAt = getLastSeenAt(rightProgress);

    if (leftLastSeenAt !== rightLastSeenAt) {
      return leftLastSeenAt - rightLastSeenAt;
    }

    const leftScore = getWordScore(leftProgress);
    const rightScore = getWordScore(rightProgress);
    if (leftScore !== rightScore) {
      return leftScore - rightScore;
    }

    return (leftProgress?.streak ?? 0) - (rightProgress?.streak ?? 0);
  });
}

function createQuestion(
  word: Word,
  pool: Word[],
  promptLanguage: LanguageCode,
  nativeLanguage: NativeLanguage,
  isReview: boolean,
): LessonQuestion | null {
  if (nativeLanguage === 'ru' && !word.russian) {
    return null;
  }

  const answerLanguage: LanguageCode = promptLanguage === 'el' ? nativeLanguage : 'el';
  const prompt = getWordLabel(word, promptLanguage);
  const correctAnswer = getWordLabel(word, answerLanguage);

  if (!prompt || !correctAnswer) {
    return null;
  }

  const requireUppercase = startsWithUppercase(correctAnswer);

  const distractors = shuffle(
    pool.filter((candidate) => {
      if (candidate.id === word.id) {
        return false;
      }

      const label = getWordLabel(candidate, answerLanguage);
      return Boolean(label && label !== correctAnswer && startsWithUppercase(label) === requireUppercase);
    }),
  )
    .map((candidate) => getWordLabel(candidate, answerLanguage))
    .filter((label): label is string => Boolean(label))
    .slice(0, Math.min(3, Math.max(1, pool.length - 1)));

  if (distractors.length === 0) {
    return null;
  }

  return {
    wordId: word.id,
    prompt,
    promptLanguage,
    answerLanguage,
    correctAnswer,
    choices: shuffle([correctAnswer, ...distractors]),
    isReview,
  };
}

function pickLessonWords(words: Word[], progress: UserProgress): Word[] {
  const orderedWords = sortWordsForLesson(words, progress);
  const weakWordIds = new Set(getWeakWordIds(progress.words, words));
  const now = Date.now();
  const unseenWords = orderedWords.filter((word) => !progress.words[word.id]);
  const weakWords = orderedWords.filter((word) => weakWordIds.has(word.id));
  const seenWords = orderedWords.filter((word) => progress.words[word.id] && !weakWordIds.has(word.id));
  const readyWeakWords = weakWords.filter((word) => !isOnCooldown(progress.words[word.id], now));
  const readySeenWords = seenWords.filter((word) => !isOnCooldown(progress.words[word.id], now));
  const cooldownWeakWords = weakWords.filter((word) => isOnCooldown(progress.words[word.id], now));
  const cooldownSeenWords = seenWords.filter((word) => isOnCooldown(progress.words[word.id], now));
  const targetWordCount = Math.min(LESSON_WORD_COUNT, orderedWords.length);

  const uniqueTargets: Word[] = [];
  const addWords = (candidates: Word[], limit: number) => {
    for (const word of candidates) {
      if (uniqueTargets.length >= limit) {
        break;
      }
      if (!uniqueTargets.some((candidate) => candidate.id === word.id)) {
        uniqueTargets.push(word);
      }
    }
  };

  // Keep newly seen words out of the next lesson whenever the group has enough older material.
  addWords(unseenWords, Math.min(6, targetWordCount));
  addWords(readyWeakWords, Math.min(9, targetWordCount));
  addWords(unseenWords, targetWordCount);
  addWords(readySeenWords, targetWordCount);
  addWords(cooldownWeakWords, targetWordCount);
  addWords(cooldownSeenWords, targetWordCount);

  return uniqueTargets.slice(0, targetWordCount);
}

function buildQuestionsForWords(
  words: Word[],
  pool: Word[],
  nativeLanguage: NativeLanguage,
  isReviewLookup: Set<string>,
): LessonQuestion[] {
  const greekToNative = words
    .map((word) => createQuestion(word, pool, 'el', nativeLanguage, isReviewLookup.has(word.id)))
    .filter((question): question is LessonQuestion => Boolean(question));

  const nativeToGreek = words
    .map((word) => createQuestion(word, pool, nativeLanguage, nativeLanguage, isReviewLookup.has(word.id)))
    .filter((question): question is LessonQuestion => Boolean(question));

  return [...greekToNative, ...nativeToGreek];
}

export function buildLessonSession(
  words: Word[],
  progress: UserProgress,
  level: Level,
  nativeLanguage: NativeLanguage,
  groupId: LessonGroupId,
): LessonSession {
  const weakWordIds = new Set(getWeakWordIds(progress.words, words));
  const lessonWords = pickLessonWords(words, progress);
  const questions = buildQuestionsForWords(lessonWords, words, nativeLanguage, weakWordIds);

  return {
    level,
    nativeLanguage,
    groupId,
    questions,
  };
}

export function buildReviewSession(
  words: Word[],
  nativeLanguage: NativeLanguage,
  wordIds: string[],
  groupId: LessonGroupId,
): LessonSession {
  const preferredWords = shuffle(words.filter((word) => wordIds.includes(word.id)));
  const fallbackWords = shuffle(words.filter((word) => !wordIds.includes(word.id)));
  const targetWords = [...preferredWords, ...fallbackWords].slice(0, Math.min(LESSON_WORD_COUNT, words.length));
  const reviewLookup = new Set(wordIds);
  const questions = buildQuestionsForWords(targetWords, words, nativeLanguage, reviewLookup);

  return {
    level: targetWords[0]?.level ?? 'A2',
    nativeLanguage,
    groupId,
    questions,
  };
}
