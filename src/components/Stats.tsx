import { t } from '../lib/i18n';
import { LEVELS, getMasteredWordCount, getWeakWordIds } from '../lib/progress';
import { wordsByLevel } from '../lib/words';
import type { Level, NativeLanguage, UserProgress } from '../types';
import styles from './Stats.module.css';
import ui from '../styles/ui.module.css';

type StatsProps = {
  uiLanguage: NativeLanguage;
  currentLevel: Level;
  currentLevelProgress: UserProgress['levels'][Level];
  progress: UserProgress;
  learnedWords: number;
  weakWords: number;
  accuracy: number;
};

function Stats({
  uiLanguage,
  currentLevel,
  currentLevelProgress,
  progress,
  learnedWords,
  weakWords,
  accuracy,
}: StatsProps) {
  return (
    <>
      <section className={`${ui.panel} ${ui.introPanel}`}>
        <p className={ui.kicker}>{t(uiLanguage, 'levelProgress')}</p>
        <h1>{t(uiLanguage, 'statsTitle')}</h1>
      </section>

      <section className={`${ui.panel} ${styles.heroPanel}`}>
        <div className={styles.heroStats}>
          <article className={styles.heroCard}>
            <span className={styles.heroLabel}>{t(uiLanguage, 'learnedWords')}</span>
            <strong className={styles.heroValue}>{learnedWords}</strong>
          </article>
          <article className={styles.heroCard}>
            <span className={styles.heroLabel}>{t(uiLanguage, 'weakWords')}</span>
            <strong className={styles.heroValue}>{weakWords}</strong>
          </article>
          <article className={styles.heroCard}>
            <span className={styles.heroLabel}>{t(uiLanguage, 'completedLessons')}</span>
            <strong className={styles.heroValue}>{currentLevelProgress.completedLessons}</strong>
          </article>
          <article className={styles.heroCard}>
            <span className={styles.heroLabel}>{t(uiLanguage, 'accuracy')}</span>
            <strong className={styles.heroValue}>{accuracy}%</strong>
          </article>
        </div>
      </section>

      <section className={`${ui.panel} ${styles.levelPanel}`}>
        {LEVELS.map((level) => {
          const levelProgress = progress.levels[level];
          const levelAttempts = levelProgress.totalCorrect + levelProgress.totalWrong;
          const levelAccuracy = levelAttempts === 0 ? 0 : Math.round((levelProgress.totalCorrect / levelAttempts) * 100);

          return (
            <article
              key={level}
              className={level === currentLevel ? `${styles.levelCard} ${styles.selected}` : styles.levelCard}
            >
              <header className={styles.levelHeader}>
                <h2>{level}</h2>
                <span className={styles.levelMeta}>
                  {wordsByLevel[level].length} {t(uiLanguage, 'words')}
                </span>
              </header>
              <p className={styles.levelCopy}>
                {getMasteredWordCount(levelProgress)} {t(uiLanguage, 'learned')}, {getWeakWordIds(levelProgress).length}{' '}
                {t(uiLanguage, 'weak')}
              </p>
              <p className={styles.levelCopy}>
                {levelProgress.completedLessons} {t(uiLanguage, 'lessons')}, {levelAccuracy}%{' '}
                {t(uiLanguage, 'accuracy').toLowerCase()}
              </p>
            </article>
          );
        })}
      </section>
    </>
  );
}

export default Stats;
