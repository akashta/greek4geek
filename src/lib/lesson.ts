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
  preferredChoiceWordIds: string[] = [],
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
  const maxDistractors = Math.min(3, Math.max(1, pool.length - 1));
  const usedLabels = new Set<string>([correctAnswer]);
  const usedWordIds = new Set<string>([word.id]);
  const distractors: { wordId: string; label: string }[] = [];

  const tryAddDistractor = (candidate: Word) => {
    if (usedWordIds.has(candidate.id)) {
      return;
    }

    const label = getWordLabel(candidate, answerLanguage);
    if (!label || usedLabels.has(label) || startsWithUppercase(label) !== requireUppercase) {
      return;
    }

    usedWordIds.add(candidate.id);
    usedLabels.add(label);
    distractors.push({ wordId: candidate.id, label });
  };

  for (const preferredWordId of preferredChoiceWordIds) {
    if (preferredWordId === word.id) {
      continue;
    }

    const preferredWord = pool.find((candidate) => candidate.id === preferredWordId);
    if (!preferredWord) {
      continue;
    }

    tryAddDistractor(preferredWord);
    if (distractors.length >= maxDistractors) {
      break;
    }
  }

  if (distractors.length < maxDistractors) {
    for (const candidate of shuffle(pool)) {
      if (candidate.id === word.id) {
        continue;
      }

      tryAddDistractor(candidate);
      if (distractors.length >= maxDistractors) {
        break;
      }
    }
  }

  if (distractors.length === 0) {
    return null;
  }

  const choiceEntries = shuffle([{ wordId: word.id, label: correctAnswer }, ...distractors]);

  return {
    wordId: word.id,
    prompt,
    promptLanguage,
    answerLanguage,
    correctAnswer,
    choices: choiceEntries.map((entry) => entry.label),
    choiceWordIds: choiceEntries.map((entry) => entry.wordId),
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

function inferChoiceWordIds(question: LessonQuestion, pool: Word[], correctWordId: string): string[] | null {
  const usedWordIds = new Set<string>();
  const choiceWordIds: string[] = [];

  for (const choice of question.choices) {
    if (choice === question.correctAnswer && !usedWordIds.has(correctWordId)) {
      usedWordIds.add(correctWordId);
      choiceWordIds.push(correctWordId);
      continue;
    }

    const matchingWord = pool.find((candidate) => {
      if (usedWordIds.has(candidate.id)) {
        return false;
      }

      return getWordLabel(candidate, question.answerLanguage) === choice;
    });

    if (!matchingWord) {
      return null;
    }

    usedWordIds.add(matchingWord.id);
    choiceWordIds.push(matchingWord.id);
  }

  return choiceWordIds;
}

function remapQuestion(
  question: LessonQuestion,
  pool: Word[],
  nativeLanguage: NativeLanguage,
): LessonQuestion | null {
  const targetWord = pool.find((word) => word.id === question.wordId);
  if (!targetWord) {
    return null;
  }

  const promptLanguage: LanguageCode = question.promptLanguage === 'el' ? 'el' : nativeLanguage;
  const preferredChoiceWordIds =
    question.choiceWordIds.length > 0
      ? question.choiceWordIds
      : inferChoiceWordIds(question, pool, targetWord.id) ?? [];

  return createQuestion(
    targetWord,
    pool,
    promptLanguage,
    nativeLanguage,
    question.isReview,
    preferredChoiceWordIds,
  );
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

export function remapLessonSession(
  session: LessonSession,
  pool: Word[],
  nativeLanguage: NativeLanguage,
): LessonSession | null {
  const questions = session.questions
    .map((question) => remapQuestion(question, pool, nativeLanguage));

  if (questions.some((question) => !question)) {
    return null;
  }

  return {
    ...session,
    nativeLanguage,
    questions: questions as LessonQuestion[],
  };
}
