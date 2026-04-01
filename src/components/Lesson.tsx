import { speakGreek } from '../lib/audio';
import { t } from '../lib/i18n';
import type { LessonAnswer, LessonQuestion, LessonSession, NativeLanguage } from '../types';
import SpeakerIcon from './SpeakerIcon';
import styles from './Lesson.module.css';
import ui from '../styles/ui.module.css';

type LessonProps = {
  uiLanguage: NativeLanguage;
  activeLesson: LessonSession;
  question: LessonQuestion;
  questionIndex: number;
  currentResponse: LessonAnswer | null;
  currentPromptLabel: string;
  onBack: () => void;
  onSubmitChoice: (choice: string) => void;
  onRevealAnswer: () => void;
  onMarkKnown: () => void;
};

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.backIcon}>
      <path
        d="M14.5 5.5 8 12l6.5 6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Lesson({
  uiLanguage,
  activeLesson,
  question,
  questionIndex,
  currentResponse,
  currentPromptLabel,
  onBack,
  onSubmitChoice,
  onRevealAnswer,
  onMarkKnown,
}: LessonProps) {
  const showAudioButton = question.promptLanguage === 'el';
  const selectedChoice = currentResponse?.selectedAnswer ?? null;

  return (
    <section className={`${ui.panel} ${styles.lessonPanel} ${styles.lessonScreen}`}>
      <div className={styles.lessonHeader}>
        <button
          type="button"
          className={styles.backButton}
          aria-label={t(uiLanguage, 'backToDashboard')}
          onClick={onBack}
        >
          <BackIcon />
        </button>
        <div className={styles.progressTrack}>
          <span className={styles.progressFill} style={{ width: `${((questionIndex + 1) / activeLesson.questions.length) * 100}%` }} />
        </div>
        <span className={styles.progressText}>
          {questionIndex + 1} / {activeLesson.questions.length}
        </span>
      </div>
      <div className={styles.promptCard}>
        <div className={styles.promptCardTop}>
          <span className={question.isReview ? `${styles.badge} ${styles.reviewBadge}` : `${styles.badge} ${styles.freshBadge}`}>
            {question.isReview ? t(uiLanguage, 'reviewHint') : t(uiLanguage, 'newHint')}
          </span>
          {showAudioButton && (
            <button
              type="button"
              className={styles.audioButton}
              aria-label={t(uiLanguage, 'audio')}
              onClick={() => speakGreek(question.prompt)}
            >
              <SpeakerIcon className={styles.speakerIcon} />
            </button>
          )}
        </div>
        <div className={styles.promptText}>{question.prompt}</div>
      </div>
      <p className={styles.promptLabel}>{currentPromptLabel}</p>

      <div className={styles.choiceGrid}>
        {question.choices.map((choice) => {
          const isSelected = selectedChoice === choice;
          const isCorrectChoice = choice === question.correctAnswer;
          const stateClass =
            currentResponse === null
              ? ''
              : isCorrectChoice
                ? 'correct'
                : currentResponse.outcome === 'wrong' && isSelected
                  ? 'wrong'
                  : 'muted';

          return (
            <button
              key={choice}
              type="button"
              className={
                stateClass
                  ? `${styles.choiceButton} ${styles[stateClass]}`
                  : styles.choiceButton
              }
              onClick={() => onSubmitChoice(choice)}
              disabled={currentResponse !== null}
            >
              {choice}
            </button>
          );
        })}
      </div>

      <div className={styles.lessonActions}>
        <button type="button" className={styles.dangerButton} onClick={onRevealAnswer} disabled={currentResponse !== null}>
          {t(uiLanguage, 'dontKnow')}
        </button>
        <button type="button" className={styles.successButton} onClick={onMarkKnown} disabled={currentResponse !== null}>
          {t(uiLanguage, 'knowIt')}
        </button>
      </div>
    </section>
  );
}

export default Lesson;
