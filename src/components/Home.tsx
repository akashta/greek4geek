import { t } from '../lib/i18n';
import { LEVELS } from '../lib/progress';
import type { Level, NativeLanguage, UserProgress } from '../types';
import styles from './Home.module.css';
import ui from '../styles/ui.module.css';

type HomeProps = {
  uiLanguage: NativeLanguage;
  settings: UserProgress['settings'];
  learnedWords: number;
  weakWords: number;
  totalWords: number;
  learnedPercent: number;
  reviewPercent: number;
  canStartLesson: boolean;
  hasMistakesToReview: boolean;
  hasRussianTranslations: boolean;
  onUpdateSettings: (nextSettings: Partial<UserProgress['settings']>) => void | Promise<void>;
  onStartLesson: () => void;
  onStartReview: () => void;
};

function Home({
  uiLanguage,
  settings,
  learnedWords,
  weakWords,
  totalWords,
  learnedPercent,
  reviewPercent,
  canStartLesson,
  hasMistakesToReview,
  hasRussianTranslations,
  onUpdateSettings,
  onStartLesson,
  onStartReview,
}: HomeProps) {
  return (
    <>
      <section className={`${ui.panel} ${ui.introPanel}`}>
        <h1>{t(uiLanguage, 'title')}</h1>
      </section>

      <section className={`${ui.panel} ${styles.settingsPanel}`}>
        <label className={styles.fieldLabel}>
          <span>{t(uiLanguage, 'level')}</span>
          <select
            className={styles.selectControl}
            value={settings.currentLevel}
            onChange={(event) => onUpdateSettings({ currentLevel: event.target.value as Level })}
          >
            {LEVELS.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.fieldLabel}>
          <span>{t(uiLanguage, 'nativeLanguage')}</span>
          <select
            className={styles.selectControl}
            value={settings.nativeLanguage}
            onChange={(event) => onUpdateSettings({ nativeLanguage: event.target.value as NativeLanguage })}
          >
            <option value="en">{t(uiLanguage, 'english')}</option>
            <option value="ru">{t(uiLanguage, 'russian')}</option>
          </select>
        </label>

        <section className={styles.levelProgressCard} aria-label={t(uiLanguage, 'levelProgress')}>
          <div className={styles.progressCopy}>
            <span className={styles.progressMeta}>
              {learnedWords} / {totalWords} {t(uiLanguage, 'learnedWords').toLowerCase()}
            </span>
          </div>
          <div className={styles.segmentedProgress} aria-hidden="true">
            <span className={`${styles.segment} ${styles.learnedSegment}`} style={{ width: `${learnedPercent}%` }} />
            <span className={`${styles.segment} ${styles.reviewSegment}`} style={{ width: `${reviewPercent}%` }} />
          </div>
          <div className={styles.progressLegend}>
            <span className={styles.legendItem}>
              <i className={`${styles.legendDot} ${styles.learnedDot}`} />
              {t(uiLanguage, 'learnedWords')}: {learnedWords}
            </span>
            <span className={styles.legendItem}>
              <i className={`${styles.legendDot} ${styles.reviewDot}`} />
              {t(uiLanguage, 'reviewReady')}: {weakWords}
            </span>
          </div>
        </section>

        {settings.nativeLanguage === 'ru' && !hasRussianTranslations && <p className={ui.notice}>{t(uiLanguage, 'noRussianData')}</p>}

        {!canStartLesson && <p className={ui.notice}>{t(uiLanguage, 'insufficientWords')}</p>}

        <div className={ui.actions}>
          <button className={ui.primaryButton} type="button" onClick={onStartLesson} disabled={!canStartLesson}>
            {t(uiLanguage, 'startLesson')}
          </button>
          <button className={ui.secondaryButton} type="button" onClick={onStartReview} disabled={!hasMistakesToReview}>
            {t(uiLanguage, 'repeatMistakes')}
          </button>
        </div>
      </section>
    </>
  );
}

export default Home;
