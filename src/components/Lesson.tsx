import { useEffect, useState } from 'react';
import { speakGreek } from '../lib/audio';
import { t } from '../lib/i18n';
import type { AudioMode, LessonAnswer, LessonQuestion, LessonSession, Mp3Voice, NativeLanguage } from '../types';
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
  audioMode: AudioMode;
  audioVoice: Mp3Voice;
  onBack: () => void;
  onSubmitChoice: (choice: string) => void;
  onRevealAnswer: () => void;
  onMarkKnown: () => void;
  hasReportedIssue: boolean;
  onReportIssue: () => void;
  onChangeUiLanguage: (language: NativeLanguage) => void;
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

function ReportIcon({ sent }: { sent: boolean }) {
  if (sent) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.reportIcon}>
        <path
          d="M6.5 12.5 10 16l7.5-8"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.reportIcon}>
      <path
        d="M12 6.75v5.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="16.6" r="1.1" fill="currentColor" />
      <path
        d="M10.4 3.8 3.9 15.1a1.6 1.6 0 0 0 1.38 2.4h13.44a1.6 1.6 0 0 0 1.38-2.4L13.6 3.8a1.84 1.84 0 0 0-3.2 0Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
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
  audioMode,
  audioVoice,
  onBack,
  onSubmitChoice,
  onRevealAnswer,
  onMarkKnown,
  hasReportedIssue,
  onReportIssue,
  onChangeUiLanguage,
}: LessonProps) {
  const showAudioButton = question.promptLanguage === 'el';
  const selectedChoice = currentResponse?.selectedAnswer ?? null;
  const reportIssueLabel = uiLanguage === 'ru' ? '\u0421\u043e\u043e\u0431\u0449\u0438\u0442\u044c \u043e\u0431 \u043e\u0448\u0438\u0431\u043a\u0435' : 'Report issue';
  const reportedIssueLabel = uiLanguage === 'ru' ? '\u041e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u043e' : 'Reported';
  const languageSwitchLabel =
    uiLanguage === 'ru'
      ? 'Switch language to English'
      : '\u041f\u0435\u0440\u0435\u043a\u043b\u044e\u0447\u0438\u0442\u044c \u044f\u0437\u044b\u043a \u043d\u0430 \u0440\u0443\u0441\u0441\u043a\u0438\u0439';
  const [isReportSent, setIsReportSent] = useState(hasReportedIssue);

  useEffect(() => {
    setIsReportSent(hasReportedIssue);
  }, [hasReportedIssue, question.answerLanguage, question.promptLanguage, question.wordId]);

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
          <div className={styles.promptCardControls}>
            {showAudioButton && (
              <button
                type="button"
                className={styles.audioButton}
                aria-label={t(uiLanguage, 'audio')}
                onClick={() => {
                  void speakGreek({ wordId: question.wordId, text: question.prompt }, audioMode, audioVoice);
                }}
              >
                <SpeakerIcon className={styles.speakerIcon} />
              </button>
            )}
          </div>
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

      <div className={styles.lessonFooter}>
        <button
          type="button"
          className={isReportSent ? `${styles.reportButton} ${styles.reportButtonSent}` : styles.reportButton}
          aria-label={isReportSent ? reportedIssueLabel : reportIssueLabel}
          title={isReportSent ? reportedIssueLabel : reportIssueLabel}
          onClick={() => {
            onReportIssue();
            setIsReportSent(true);
          }}
          disabled={isReportSent}
        >
          <ReportIcon sent={isReportSent} />
          <span className={styles.reportButtonLabel}>{isReportSent ? reportedIssueLabel : reportIssueLabel}</span>
        </button>
        <button
          type="button"
          className={`${styles.reportButton} ${styles.languageSwitchButton}`}
          onClick={() => onChangeUiLanguage(uiLanguage === 'ru' ? 'en' : 'ru')}
          aria-label={languageSwitchLabel}
        >
          <span className={uiLanguage === 'ru' ? styles.languageSwitchCurrent : styles.languageSwitchOption}>ru</span>
          <span className={styles.languageSwitchDivider}>/</span>
          <span className={uiLanguage === 'en' ? styles.languageSwitchCurrent : styles.languageSwitchOption}>en</span>
        </button>
      </div>
    </section>
  );
}

export default Lesson;
