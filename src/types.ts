export type Level = 'A2' | 'B1';
export type NativeLanguage = 'en' | 'ru';
export type LanguageCode = 'el' | NativeLanguage;
export type AudioMode = 'tts' | 'mp3';
export type Mp3Voice = 'aoede' | 'charon' | 'standard-b';
export type LessonGroupId =
  | 'all'
  | 'basics'
  | 'language'
  | 'technology'
  | 'verbs'
  | 'people'
  | 'names'
  | 'food'
  | 'home'
  | 'body'
  | 'health'
  | 'clothes'
  | 'money'
  | 'school'
  | 'city'
  | 'countries'
  | 'weather'
  | 'nature'
  | 'animals'
  | 'time'
  | 'colors'
  | 'sports'
  | 'music'
  | 'communication'
  | 'space'
  | 'objects'
  | 'descriptions'
  | 'concepts'
  | 'feelings'
  | 'leisure'
  | 'society'
  | 'geography'
  | 'professions'
  | 'travel'
  | 'shopping'
  | 'holidays'
  | 'general';

export type WordGroupId = Exclude<LessonGroupId, 'all'>;

export interface Word {
  id: string;
  greek: string;
  english: string;
  russian?: string;
  level: Level;
  group: WordGroupId;
}

export interface WordProgress {
  correct: number;
  wrong: number;
  streak: number;
  learnedByChoice?: boolean;
  lastSeenAt?: number;
}

export interface LevelStats {
  completedLessons: number;
  totalCorrect: number;
  totalWrong: number;
  lastStudiedAt?: string;
}

export interface UserSettings {
  currentLevel: Level;
  nativeLanguage: NativeLanguage;
  hasCompletedOnboarding: boolean;
  autoPlayAudio: boolean;
  audioMode: AudioMode;
  audioVoice: Mp3Voice;
}

export interface UserProgress {
  settings: UserSettings;
  words: Record<string, WordProgress>;
  levels: Record<Level, LevelStats>;
}

export interface LessonQuestion {
  wordId: string;
  prompt: string;
  promptLanguage: LanguageCode;
  answerLanguage: LanguageCode;
  correctAnswer: string;
  choices: string[];
  choiceWordIds: string[];
  isReview: boolean;
}

export interface LessonSession {
  level: Level;
  nativeLanguage: NativeLanguage;
  groupId: LessonGroupId;
  questions: LessonQuestion[];
}

export interface LessonAnswer {
  question: LessonQuestion;
  selectedAnswer?: string;
  outcome: 'correct' | 'wrong' | 'dont_know' | 'know_it';
}
