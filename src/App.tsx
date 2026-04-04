import { useEffect, useMemo, useRef, useState } from 'react';
import * as Sentry from '@sentry/react';
import BottomNav from './components/BottomNav';
import Home from './components/Home';
import Lesson from './components/Lesson';
import Onboarding from './components/Onboarding';
import Results from './components/Results';
import Settings from './components/Settings';
import Stats from './components/Stats';
import styles from './App.module.css';
import { playCorrectSound, playLessonFinishedSound, playWrongSound, speakGreek } from './lib/audio';
import { buildLessonGroupSummaries, getWordsForGroup } from './lib/groups';
import { t } from './lib/i18n';
import { buildLessonSession, buildReviewSession, remapLessonSession } from './lib/lesson';
import { applyLessonAnswers, createDefaultProgress, getMasteredWordCount, getWeakWordIds } from './lib/progress';
import { getStorageAdapter } from './lib/storage';
import { hasCompleteNativeTranslations, wordsByLevel } from './lib/words';
import type { LessonAnswer, LessonGroupId, LessonSession, UserProgress } from './types';

type Screen = 'home' | 'stats' | 'settings' | 'lesson' | 'results';

const storage = getStorageAdapter();

function getQuestionReportKey(question: LessonSession['questions'][number]): string {
  return `${question.wordId}:${question.promptLanguage}:${question.answerLanguage}`;
}

function getQuestionReportPayload(question: LessonSession['questions'][number]) {
  return {
    greek: question.promptLanguage === 'el' ? question.prompt : question.correctAnswer,
    translation: question.promptLanguage === 'el' ? question.correctAnswer : question.prompt,
    translationLanguage: question.promptLanguage === 'el' ? question.answerLanguage : question.promptLanguage,
  };
}

function App() {
  const advanceTimeoutRef = useRef<number | null>(null);
  const lastAutoSpokenQuestionRef = useRef<string | null>(null);
  const [progress, setProgress] = useState<UserProgress>(createDefaultProgress());
  const [screen, setScreen] = useState<Screen>('home');
  const [activeLesson, setActiveLesson] = useState<LessonSession | null>(null);
  const [answers, setAnswers] = useState<LessonAnswer[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [currentResponse, setCurrentResponse] = useState<LessonAnswer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reportedQuestionKey, setReportedQuestionKey] = useState<string | null>(null);

  const currentLevel = progress.settings.currentLevel;
  const currentWords = wordsByLevel[currentLevel];
  const currentLevelStats = progress.levels[currentLevel];
  const uiLanguage = progress.settings.nativeLanguage;
  const autoPlayAudio = progress.settings.autoPlayAudio;
  const audioMode = progress.settings.audioMode;
  const audioVoice = progress.settings.audioVoice;
  const question = activeLesson?.questions[questionIndex] ?? null;
  const groupSummaries = useMemo(
    () => buildLessonGroupSummaries(currentWords, progress.words, uiLanguage),
    [currentWords, progress.words, uiLanguage],
  );
  const hasRussianTranslations = useMemo(
    () => hasCompleteNativeTranslations(currentWords, progress.settings.nativeLanguage),
    [currentWords, progress.settings.nativeLanguage],
  );

  useEffect(() => {
    let mounted = true;

    async function load() {
      const nextProgress = await storage.loadProgress();
      if (mounted) {
        setProgress(nextProgress);
        setIsLoading(false);
      }
    }

    void load();

    return () => {
      mounted = false;
      if (advanceTimeoutRef.current !== null) {
        window.clearTimeout(advanceTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!autoPlayAudio || screen !== 'lesson' || !question || question.promptLanguage !== 'el') {
      return;
    }

    const questionKey = `${question.wordId}:${questionIndex}:${question.promptLanguage}`;
    if (lastAutoSpokenQuestionRef.current === questionKey) {
      return;
    }

    lastAutoSpokenQuestionRef.current = questionKey;
    void speakGreek({ wordId: question.wordId, text: question.prompt }, audioMode, audioVoice);
  }, [audioMode, audioVoice, autoPlayAudio, question, questionIndex, screen]);

  async function persistProgress(nextProgress: UserProgress) {
    setProgress(nextProgress);
    await storage.saveProgress(nextProgress);
  }

  async function updateSettings(nextSettings: Partial<UserProgress['settings']>) {
    const nextProgress = {
      ...progress,
      settings: {
        ...progress.settings,
        ...nextSettings,
      },
    };
    await persistProgress(nextProgress);
  }

  async function completeOnboarding(nextSettings: Pick<UserProgress['settings'], 'currentLevel' | 'nativeLanguage'>) {
    const nextProgress = {
      ...progress,
      settings: {
        ...progress.settings,
        ...nextSettings,
        hasCompletedOnboarding: true,
      },
    };
    await persistProgress(nextProgress);
    setScreen('home');
  }

  function openLesson(lesson: LessonSession) {
    if (advanceTimeoutRef.current !== null) {
      window.clearTimeout(advanceTimeoutRef.current);
      advanceTimeoutRef.current = null;
    }
    lastAutoSpokenQuestionRef.current = null;
    setActiveLesson(lesson);
    setAnswers([]);
    setQuestionIndex(0);
    setCurrentResponse(null);
    setReportedQuestionKey(null);
    setScreen('lesson');
  }

  function reportCurrentWord() {
    if (!question || !activeLesson) {
      return;
    }

    const reportKey = getQuestionReportKey(question);
    if (reportedQuestionKey === reportKey) {
      return;
    }

    const { greek, translation, translationLanguage } = getQuestionReportPayload(question);

    Sentry.withScope((scope) => {
      scope.setTag('feature', 'word-report');
      scope.setTag('word_id', question.wordId);
      scope.setTag('group_id', activeLesson.groupId);
      scope.setTag('level', activeLesson.level);
      scope.setTag('translation_language', translationLanguage);
      scope.setContext('word_report', {
        greek,
        translation,
        prompt: question.prompt,
        correctAnswer: question.correctAnswer,
        promptLanguage: question.promptLanguage,
        answerLanguage: question.answerLanguage,
        isReview: question.isReview,
      });

      Sentry.captureFeedback(
        {
          message: 'Word card reported by user',
          source: 'word-card-button',
          url: window.location.href,
          tags: {
            feature: 'word-report',
            word_id: question.wordId,
            group_id: activeLesson.groupId,
            level: activeLesson.level,
            translation_language: translationLanguage,
          },
        },
      );
    });

    setReportedQuestionKey(reportKey);
  }

  function startLessonForGroup(groupId: LessonGroupId) {
    const groupWords = getWordsForGroup(currentWords, groupId);
    if (groupWords.length === 0) {
      return;
    }

    if (!hasCompleteNativeTranslations(groupWords, progress.settings.nativeLanguage)) {
      return;
    }

    const lesson = buildLessonSession(
      groupWords,
      progress,
      progress.settings.currentLevel,
      progress.settings.nativeLanguage,
      groupId,
    );

    if (lesson.questions.length === 0) {
      return;
    }

    openLesson(lesson);
  }

  function startReview(wordIds?: string[], groupId: LessonGroupId = 'all') {
    const reviewWords = getWordsForGroup(currentWords, groupId);
    const targetWordIds =
      wordIds && wordIds.length > 0
        ? wordIds
        : getWeakWordIds(progress.words, reviewWords);
    openLesson(
      buildReviewSession(
        reviewWords,
        progress.settings.nativeLanguage,
        targetWordIds,
        groupId,
      ),
    );
  }

  function queueAdvance(nextAnswers: LessonAnswer[]) {
    advanceTimeoutRef.current = window.setTimeout(() => {
      void moveToNextQuestion(nextAnswers);
    }, 850);
  }

  function submitChoice(choice: string) {
    if (!question || currentResponse) {
      return;
    }

    const isCorrect = choice === question.correctAnswer;
    const response: LessonAnswer = {
      question,
      selectedAnswer: choice,
      outcome: isCorrect ? 'correct' : 'wrong',
    };
    const nextAnswers = [...answers, response];

    setCurrentResponse(response);
    setAnswers(nextAnswers);

    const playResultSound = () => {
      if (isCorrect) {
        playCorrectSound();
      } else {
        playWrongSound();
      }
    };

    if (question.answerLanguage === 'el') {
      void speakGreek({ text: choice }, audioMode, audioVoice).finally(() => {
        playResultSound();
        queueAdvance(nextAnswers);
      });
      return;
    }

    playResultSound();
    queueAdvance(nextAnswers);
  }

  function revealAnswer() {
    if (!question || currentResponse) {
      return;
    }

    const response: LessonAnswer = {
      question,
      outcome: 'dont_know',
    };
    const nextAnswers = [...answers, response];

    setCurrentResponse(response);
    setAnswers(nextAnswers);

    const greekText = question.answerLanguage === 'el' ? question.correctAnswer : null;

    if (greekText) {
      void speakGreek({ wordId: question.wordId, text: greekText }, audioMode, audioVoice).finally(() => {
        playWrongSound();
        queueAdvance(nextAnswers);
      });
      return;
    }

    playWrongSound();
    queueAdvance(nextAnswers);
  }

  function markKnown() {
    if (!question || currentResponse) {
      return;
    }

    const response: LessonAnswer = {
      question,
      outcome: 'know_it',
    };
    const nextAnswers = [...answers, response];

    setCurrentResponse(response);
    setAnswers(nextAnswers);
    playCorrectSound();
    queueAdvance(nextAnswers);
  }

  async function moveToNextQuestion(nextAnswersArg?: LessonAnswer[]) {
    if (!activeLesson) {
      return;
    }

    if (advanceTimeoutRef.current !== null) {
      window.clearTimeout(advanceTimeoutRef.current);
      advanceTimeoutRef.current = null;
    }

    const nextAnswers = nextAnswersArg ?? answers;
    const isLastQuestion = questionIndex >= activeLesson.questions.length - 1;
    if (isLastQuestion) {
      const nextProgress = applyLessonAnswers(progress, activeLesson.level, nextAnswers);
      playLessonFinishedSound();
      await persistProgress(nextProgress);
      setScreen('results');
      return;
    }

    setQuestionIndex((current) => current + 1);
    setCurrentResponse(null);
  }

  function resetToHome() {
    if (advanceTimeoutRef.current !== null) {
      window.clearTimeout(advanceTimeoutRef.current);
      advanceTimeoutRef.current = null;
    }
    lastAutoSpokenQuestionRef.current = null;
    setActiveLesson(null);
    setAnswers([]);
    setQuestionIndex(0);
    setCurrentResponse(null);
    setReportedQuestionKey(null);
    setScreen('home');
  }

  function remapAnswer(answer: LessonAnswer, nextQuestion: LessonSession['questions'][number]): LessonAnswer {
    if (!answer.selectedAnswer) {
      return {
        ...answer,
        question: nextQuestion,
      };
    }

    const selectedIndex = answer.question.choices.indexOf(answer.selectedAnswer);
    return {
      ...answer,
      question: nextQuestion,
      selectedAnswer: selectedIndex >= 0 ? nextQuestion.choices[selectedIndex] : undefined,
    };
  }

  const correctAnswers = answers.filter((answer) => answer.outcome === 'correct').length;
  const scoredAnswers = answers.filter((answer) => answer.outcome !== 'know_it').length;
  const weakWords = getWeakWordIds(progress.words, currentWords).length;
  const learnedWords = getMasteredWordCount(progress.words, currentWords);
  const totalWords = currentWords.length;
  const needsOnboarding = !progress.settings.hasCompletedOnboarding;
  const newWords = Math.max(0, totalWords - learnedWords - weakWords);
  const learnedPercent =
    totalWords === 0 ? 0 : Math.min(100, (learnedWords / totalWords) * 100);
  const reviewPercent =
    totalWords === 0 ? 0 : Math.min(100 - learnedPercent, (weakWords / totalWords) * 100);
  const newPercent = Math.max(0, 100 - learnedPercent - reviewPercent);
  const totalAttempts = currentLevelStats.totalCorrect + currentLevelStats.totalWrong;
  const accuracy = totalAttempts === 0 ? 0 : Math.round((currentLevelStats.totalCorrect / totalAttempts) * 100);
  const lessonMistakes = answers
    .filter((answer) => answer.outcome === 'wrong' || answer.outcome === 'dont_know')
    .map((answer) => answer.question.wordId);
  const mistakeAnswers = answers.filter((answer) => answer.outcome === 'wrong' || answer.outcome === 'dont_know');
  const hasMistakesToReview = weakWords > 0;
  const currentPromptLabel =
    question?.answerLanguage === 'el' ? t(uiLanguage, 'answerGreek') : t(uiLanguage, 'answerNative');

  if (isLoading) {
    return <main className={`${styles.appShell} ${styles.loadingState}`}>{t(uiLanguage, 'loading')}</main>;
  }

  return (
    <main
      className={
        screen === 'lesson' || screen === 'results'
          ? `${styles.appShell} ${styles.appShellFocused}`
          : styles.appShell
      }
    >
      {needsOnboarding && <Onboarding onComplete={completeOnboarding} />}
      {!needsOnboarding && screen === 'home' && (
        <Home
          uiLanguage={uiLanguage}
          currentLevel={currentLevel}
          learnedWords={learnedWords}
          weakWords={weakWords}
          newWords={newWords}
          totalWords={totalWords}
          learnedPercent={learnedPercent}
          reviewPercent={reviewPercent}
          newPercent={newPercent}
          groupSummaries={groupSummaries}
          hasMistakesToReview={hasMistakesToReview}
          hasRussianTranslations={hasRussianTranslations}
          onStartGroupLesson={startLessonForGroup}
          onStartReview={() => startReview(undefined, 'all')}
        />
      )}
      {!needsOnboarding && screen === 'stats' && (
        <Stats
          uiLanguage={uiLanguage}
          currentLevel={currentLevel}
          currentLevelStats={currentLevelStats}
          progress={progress}
          learnedWords={learnedWords}
          weakWords={weakWords}
          accuracy={accuracy}
        />
      )}
      {!needsOnboarding && screen === 'settings' && (
        <Settings
          uiLanguage={uiLanguage}
          settings={progress.settings}
          hasRussianTranslations={hasRussianTranslations}
          onUpdateSettings={updateSettings}
        />
      )}
      {!needsOnboarding && screen === 'lesson' && question && activeLesson && (
        <Lesson
          uiLanguage={uiLanguage}
          activeLesson={activeLesson}
          question={question}
          questionIndex={questionIndex}
          currentResponse={currentResponse}
          currentPromptLabel={currentPromptLabel}
          audioMode={audioMode}
          audioVoice={audioVoice}
          onBack={resetToHome}
          onSubmitChoice={submitChoice}
          onRevealAnswer={revealAnswer}
          onMarkKnown={markKnown}
          hasReportedIssue={reportedQuestionKey === getQuestionReportKey(question)}
          onReportIssue={reportCurrentWord}
          onChangeUiLanguage={(language) => {
            if (!activeLesson || language === uiLanguage) {
              void updateSettings({ nativeLanguage: language });
              return;
            }

            const lessonWords = getWordsForGroup(wordsByLevel[activeLesson.level], activeLesson.groupId);
            const nextLesson = remapLessonSession(activeLesson, lessonWords, language);
            if (!nextLesson) {
              return;
            }

            const currentQuestion = activeLesson.questions[questionIndex];
            const nextQuestion = nextLesson.questions[questionIndex];
            setActiveLesson(nextLesson);
            setAnswers((currentAnswers) =>
              currentAnswers.map((answer, index) => remapAnswer(answer, nextLesson.questions[index])),
            );
            setCurrentResponse((currentAnswer) =>
              currentAnswer && nextQuestion ? remapAnswer(currentAnswer, nextQuestion) : currentAnswer,
            );
            if (currentQuestion && nextQuestion && reportedQuestionKey === getQuestionReportKey(currentQuestion)) {
              setReportedQuestionKey(getQuestionReportKey(nextQuestion));
            }
            void updateSettings({ nativeLanguage: language });
          }}
        />
      )}
      {!needsOnboarding && screen === 'results' && (
        <Results
          uiLanguage={uiLanguage}
          correctAnswers={correctAnswers}
          scoredAnswers={scoredAnswers}
          totalAnswers={answers.length}
          lessonMistakes={lessonMistakes}
          mistakeAnswers={mistakeAnswers}
          onBack={resetToHome}
          onContinue={() => startLessonForGroup(activeLesson?.groupId ?? 'all')}
          onStartReview={() => startReview(lessonMistakes, activeLesson?.groupId ?? 'all')}
        />
      )}

      {!needsOnboarding && (screen === 'home' || screen === 'stats' || screen === 'settings') && (
        <BottomNav screen={screen} uiLanguage={uiLanguage} onChangeScreen={setScreen} />
      )}
    </main>
  );
}

export default App;
