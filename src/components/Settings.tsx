import { t } from '../lib/i18n';
import { LEVELS } from '../lib/progress';
import type { AudioMode, Level, Mp3Voice, NativeLanguage, UserProgress } from '../types';
import styles from './Home.module.css';
import ui from '../styles/ui.module.css';

type SettingsProps = {
  uiLanguage: NativeLanguage;
  settings: UserProgress['settings'];
  hasRussianTranslations: boolean;
  onUpdateSettings: (nextSettings: Partial<UserProgress['settings']>) => void | Promise<void>;
};

function Settings({ uiLanguage, settings, hasRussianTranslations, onUpdateSettings }: SettingsProps) {
  return (
    <>
      <section className={`${ui.panel} ${ui.introPanel}`}>
        <h1>{t(uiLanguage, 'settingsTitle')}</h1>
      </section>

      <section className={`${ui.panel} ${styles.settingsPanel}`}>
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

        <label className={styles.toggleControl}>
          <span>{t(uiLanguage, 'autoPlayAudio')}</span>
          <input
            className={styles.toggleInput}
            type="checkbox"
            checked={settings.autoPlayAudio}
            onChange={(event) => onUpdateSettings({ autoPlayAudio: event.target.checked })}
          />
        </label>

        <label className={styles.fieldLabel}>
          <span>{t(uiLanguage, 'audioMode')}</span>
          <select
            className={styles.selectControl}
            value={settings.audioMode}
            onChange={(event) => onUpdateSettings({ audioMode: event.target.value as AudioMode })}
          >
            <option value="mp3">{t(uiLanguage, 'audioModeMp3')}</option>
            <option value="tts">{t(uiLanguage, 'audioModeTts')}</option>
          </select>
        </label>

        <label className={styles.fieldLabel}>
          <span>{t(uiLanguage, 'audioVoice')}</span>
          <select
            className={styles.selectControl}
            value={settings.audioVoice}
            onChange={(event) => onUpdateSettings({ audioVoice: event.target.value as Mp3Voice })}
          >
            <option value="aoede">{t(uiLanguage, 'audioVoiceAoede')}</option>
            <option value="charon">{t(uiLanguage, 'audioVoiceCharon')}</option>
            <option value="standard-b">{t(uiLanguage, 'audioVoiceStandardB')}</option>
          </select>
        </label>

        {settings.nativeLanguage === 'ru' && !hasRussianTranslations && <p className={ui.notice}>{t(uiLanguage, 'noRussianData')}</p>}
      </section>
    </>
  );
}

export default Settings;
