import type { LevelStats, UserProgress, UserSettings, WordProgress } from '../types';
import { createDefaultProgress, mergeProgress } from './progress';
import { supportsTelegramDeviceStorage } from './telegram';

export interface AppStorage {
  loadProgress(): Promise<UserProgress>;
  saveProgress(progress: UserProgress): Promise<void>;
}

const STORAGE_PREFIX = 'greek-trainer';

function hasStoredProgress(progress: UserProgress): boolean {
  if (progress.settings.hasCompletedOnboarding) {
    return true;
  }

  if (Object.keys(progress.words).length > 0) {
    return true;
  }

  return Object.values(progress.levels).some(
    (level) =>
      level.completedLessons > 0 ||
      level.totalCorrect > 0 ||
      level.totalWrong > 0 ||
      Boolean(level.lastStudiedAt),
  );
}

class LocalStorageAdapter implements AppStorage {
  async loadProgress(): Promise<UserProgress> {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}:progress`);
    if (!raw) {
      return createDefaultProgress();
    }

    try {
      return mergeProgress(JSON.parse(raw) as UserProgress);
    } catch {
      return createDefaultProgress();
    }
  }

  async saveProgress(progress: UserProgress): Promise<void> {
    window.localStorage.setItem(`${STORAGE_PREFIX}:progress`, JSON.stringify(progress));
  }
}

class TelegramDeviceStorageAdapter implements AppStorage {
  async loadProgress(): Promise<UserProgress> {
    const settings = await this.getItem<UserSettings>('settings');
    const [words, statsA2, statsB1] = await Promise.all([
      this.getItem<Record<string, WordProgress>>('progress_words'),
      this.getItem<LevelStats>('stats_A2'),
      this.getItem<LevelStats>('stats_B1'),
    ]);

    return mergeProgress({
      settings: settings ?? createDefaultProgress().settings,
      words: words ?? undefined,
      levels: {
        A2: statsA2 ?? createDefaultProgress().levels.A2,
        B1: statsB1 ?? createDefaultProgress().levels.B1,
      },
    });
  }

  async saveProgress(progress: UserProgress): Promise<void> {
    await Promise.all([
      this.setItem('settings', progress.settings),
      this.setItem('progress_words', progress.words),
      this.setItem('stats_A2', progress.levels.A2),
      this.setItem('stats_B1', progress.levels.B1),
    ]);
  }

  private async getItem<T>(key: string): Promise<T | null> {
    const deviceStorage = window.Telegram?.WebApp?.DeviceStorage;
    if (!deviceStorage) {
      return null;
    }

    try {
      return await new Promise((resolve) => {
        deviceStorage.getItem(`${STORAGE_PREFIX}:${key}`, (error, value) => {
          if (error || !value) {
            resolve(null);
            return;
          }

          try {
            resolve(JSON.parse(value) as T);
          } catch {
            resolve(null);
          }
        });
      });
    } catch {
      return null;
    }
  }

  private async setItem(key: string, value: unknown): Promise<void> {
    const deviceStorage = window.Telegram?.WebApp?.DeviceStorage;
    if (!deviceStorage) {
      return;
    }

    try {
      await new Promise<void>((resolve) => {
        deviceStorage.setItem(`${STORAGE_PREFIX}:${key}`, JSON.stringify(value), () => resolve());
      });
    } catch {
      return;
    }
  }
}

class SmartStorageAdapter implements AppStorage {
  private readonly localStorageAdapter = new LocalStorageAdapter();

  private readonly telegramStorageAdapter = new TelegramDeviceStorageAdapter();

  async loadProgress(): Promise<UserProgress> {
    const localProgress = await this.localStorageAdapter.loadProgress();

    if (!supportsTelegramDeviceStorage()) {
      return localProgress;
    }

    const telegramProgress = await this.telegramStorageAdapter.loadProgress();
    return hasStoredProgress(telegramProgress) ? telegramProgress : localProgress;
  }

  async saveProgress(progress: UserProgress): Promise<void> {
    await this.localStorageAdapter.saveProgress(progress);

    if (!supportsTelegramDeviceStorage()) {
      return;
    }

    await this.telegramStorageAdapter.saveProgress(progress);
  }
}

export function getStorageAdapter(): AppStorage {
  return new SmartStorageAdapter();
}
