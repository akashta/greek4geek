import type { CSSProperties } from 'react';
import { t } from '../lib/i18n';
import type { LessonAnswer, NativeLanguage } from '../types';
import styles from './Results.module.css';
import ui from '../styles/ui.module.css';

type ResultsProps = {
  uiLanguage: NativeLanguage;
  correctAnswers: number;
  scoredAnswers: number;
  totalAnswers: number;
  lessonMistakes: string[];
  mistakeAnswers: LessonAnswer[];
  onBack: () => void;
  onContinue: () => void;
  onStartReview: () => void;
};

const CONFETTI_PIECES = [
  { left: '4%', delay: '0s', duration: '2.15s', rotation: '18deg', color: '#f3b24d' },
  { left: '11%', delay: '0.18s', duration: '2.35s', rotation: '-12deg', color: '#2aa572' },
  { left: '19%', delay: '0.42s', duration: '2.25s', rotation: '26deg', color: '#4f91ec' },
  { left: '27%', delay: '0.1s', duration: '2.4s', rotation: '-22deg', color: '#ef7f52' },
  { left: '35%', delay: '0.58s', duration: '2.2s', rotation: '14deg', color: '#f3d06b' },
  { left: '43%', delay: '0.28s', duration: '2.5s', rotation: '-30deg', color: '#7cba5b' },
  { left: '51%', delay: '0.05s', duration: '2.3s', rotation: '20deg', color: '#f06aa7' },
  { left: '59%', delay: '0.5s', duration: '2.45s', rotation: '-16deg', color: '#55a8f5' },
  { left: '67%', delay: '0.2s', duration: '2.18s', rotation: '28deg', color: '#f1b24f' },
  { left: '75%', delay: '0.62s', duration: '2.38s', rotation: '-24deg', color: '#24a06f' },
  { left: '83%', delay: '0.34s', duration: '2.28s', rotation: '12deg', color: '#f08d4f' },
  { left: '91%', delay: '0.08s', duration: '2.22s', rotation: '-18deg', color: '#4b86e4' },
];

function Results({
  uiLanguage,
  correctAnswers,
  scoredAnswers,
  totalAnswers,
  lessonMistakes,
  mistakeAnswers,
  onBack,
  onContinue,
  onStartReview,
}: ResultsProps) {
  return (
    <section className={`${ui.panel} ${styles.resultsPanel} ${styles.resultsScreen}`}>
      <div className={styles.confettiLayer} aria-hidden="true">
        {CONFETTI_PIECES.map((piece, index) => (
          <span
            key={`${piece.left}-${index}`}
            className={styles.confettiPiece}
            style={
              {
                '--confetti-left': piece.left,
                '--confetti-delay': piece.delay,
                '--confetti-duration': piece.duration,
                '--confetti-rotation': piece.rotation,
                '--confetti-color': piece.color,
              } as CSSProperties
            }
          />
        ))}
      </div>
      <p className={ui.kicker}>{t(uiLanguage, 'score')}</p>
      <h1>
        {correctAnswers}/{scoredAnswers || totalAnswers}
      </h1>

      <section className={styles.resultsBlock}>
        {lessonMistakes.length === 0 ? (
          <p className={styles.emptyMessage}>{t(uiLanguage, 'noMistakes')}</p>
        ) : (
          <>
            <h2 className={styles.resultsHeading}>{t(uiLanguage, 'mistakesList')}</h2>
            <div className={`${styles.resultsList} ${styles.compactResultsList}`}>
              {mistakeAnswers.slice(0, 8).map((answer) => (
                <article key={`${answer.question.wordId}-${answer.question.prompt}`} className={styles.resultsRow}>
                  <strong className={styles.resultsPrompt}>{answer.question.prompt}</strong>
                  <span className={styles.resultsArrow}>&rarr;</span>
                  <span className={styles.resultsAnswer}>{answer.question.correctAnswer}</span>
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      <div className={ui.actions}>
        <button type="button" className={ui.primaryButton} onClick={onContinue}>
          {t(uiLanguage, 'continueAction')}
        </button>
        <button type="button" className={ui.secondaryButton} onClick={onStartReview} disabled={lessonMistakes.length === 0}>
          {t(uiLanguage, 'repeatMistakes')}
        </button>
        <button type="button" className={ui.ghostButton} onClick={onBack}>
          {t(uiLanguage, 'backToDashboard')}
        </button>
      </div>
    </section>
  );
}

export default Results;
