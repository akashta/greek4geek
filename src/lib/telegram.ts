type TelegramThemeParams = {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
};

type TelegramDeviceStorage = {
  getItem: (key: string, callback: (error: Error | null, value: string | null) => void) => void;
  setItem: (key: string, value: string, callback?: (error: Error | null, success: boolean) => void) => void;
};

type TelegramBackButton = {
  show?: () => void;
  hide?: () => void;
  onClick?: (callback: () => void) => void;
  offClick?: (callback: () => void) => void;
};

export type TelegramWebApp = {
  initData?: string;
  ready?: () => void;
  expand?: () => void;
  version?: string;
  isVersionAtLeast?: (version: string) => boolean;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  onEvent?: (eventType: string, handler: () => void) => void;
  offEvent?: (eventType: string, handler: () => void) => void;
  viewportHeight?: number;
  colorScheme?: 'light' | 'dark';
  themeParams?: TelegramThemeParams;
  initDataUnsafe?: {
    user?: {
      id?: number;
      username?: string;
      first_name?: string;
      last_name?: string;
      language_code?: string;
    };
    start_param?: string;
  };
  BackButton?: TelegramBackButton;
  DeviceStorage?: TelegramDeviceStorage;
};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

function setViewportHeight(webApp: TelegramWebApp): void {
  if (!webApp.viewportHeight) {
    return;
  }

  const height = `${webApp.viewportHeight}px`;
  document.documentElement.style.setProperty('--tg-viewport-height', height);
  document.documentElement.style.setProperty('--app-height', height);
}

function applyTheme(webApp: TelegramWebApp): void {
  const root = document.documentElement;
  const theme = webApp.themeParams;
  if (!theme) {
    return;
  }

  if (theme.bg_color) {
    root.style.setProperty('--tg-bg-color', theme.bg_color);
    webApp.setBackgroundColor?.(theme.bg_color);
  }
  if (theme.text_color) {
    root.style.setProperty('--tg-text-color', theme.text_color);
  }
  if (theme.hint_color) {
    root.style.setProperty('--tg-hint-color', theme.hint_color);
  }
  if (theme.button_color) {
    root.style.setProperty('--tg-button-color', theme.button_color);
  }
  if (theme.button_text_color) {
    root.style.setProperty('--tg-button-text-color', theme.button_text_color);
  }
  if (theme.secondary_bg_color) {
    root.style.setProperty('--tg-secondary-bg-color', theme.secondary_bg_color);
    webApp.setHeaderColor?.(theme.secondary_bg_color);
  }
}

export function getTelegramWebApp(): TelegramWebApp | null {
  return window.Telegram?.WebApp ?? null;
}

export function isTelegramMiniApp(): boolean {
  const webApp = getTelegramWebApp();
  return Boolean(webApp?.initData);
}

export function supportsTelegramDeviceStorage(): boolean {
  const webApp = getTelegramWebApp();
  if (!webApp?.DeviceStorage || !isTelegramMiniApp()) {
    return false;
  }

  return webApp.isVersionAtLeast ? webApp.isVersionAtLeast('9.0') : true;
}

export function initTelegramWebApp(): void {
  const webApp = getTelegramWebApp();
  if (!webApp || !isTelegramMiniApp()) {
    document.documentElement.style.setProperty('--app-height', '100vh');
    return;
  }

  document.documentElement.dataset.telegram = 'true';
  webApp.ready?.();
  webApp.expand?.();
  applyTheme(webApp);
  setViewportHeight(webApp);

  const syncViewport = () => setViewportHeight(webApp);
  webApp.onEvent?.('viewportChanged', syncViewport);
}
