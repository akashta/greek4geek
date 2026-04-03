import type { AudioMode } from '../types';

type GreekAudioInput =
  | string
  | {
      wordId?: string;
      text?: string;
    };

type GreekAudioManifest = {
  byId: Record<string, string>;
  byGreek: Record<string, string>;
};

const DEFAULT_MP3_VOICE = 'charon';

let currentGreekAudio: HTMLAudioElement | null = null;
let greekAudioManifestPromise: Promise<GreekAudioManifest | null> | null = null;
let currentGreekUtterance: SpeechSynthesisUtterance | null = null;

function getAppAssetUrl(path: string): string {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '/');
  const cleanPath = path.replace(/^\/+/, '');
  return `${base}${cleanPath}`;
}

async function loadGreekAudioManifest(): Promise<GreekAudioManifest | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  if (!greekAudioManifestPromise) {
    greekAudioManifestPromise = fetch(getAppAssetUrl(`audio/${DEFAULT_MP3_VOICE}/manifest.json`))
      .then(async (response) => {
        if (!response.ok) {
          return null;
        }

        return (await response.json()) as GreekAudioManifest;
      })
      .catch(() => null);
  }

  return greekAudioManifestPromise;
}

async function resolveGreekAudioUrl(input: GreekAudioInput): Promise<string | null> {
  const manifest = await loadGreekAudioManifest();
  if (!manifest) {
    return null;
  }

  if (typeof input === 'string') {
    const manifestPath = manifest.byGreek[input];
    return manifestPath ? getAppAssetUrl(manifestPath) : null;
  }

  const manifestPath =
    (input.wordId ? manifest.byId[input.wordId] : undefined) ??
    (input.text ? manifest.byGreek[input.text] : undefined);

  return manifestPath ? getAppAssetUrl(manifestPath) : null;
}

function getGreekText(input: GreekAudioInput): string | null {
  if (typeof input === 'string') {
    return input;
  }

  return input.text ?? null;
}

function stopGreekPlayback(): void {
  if (currentGreekAudio) {
    currentGreekAudio.pause();
    currentGreekAudio.currentTime = 0;
    currentGreekAudio = null;
  }

  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    currentGreekUtterance = null;
  }
}

function canUseGreekTts(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
}

function speakGreekWithTts(input: GreekAudioInput): Promise<boolean> {
  const text = getGreekText(input);
  if (!text || !canUseGreekTts()) {
    return Promise.resolve(false);
  }

  stopGreekPlayback();

  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    currentGreekUtterance = utterance;
    utterance.lang = 'el-GR';

    let settled = false;
    const finish = (didSpeak: boolean) => {
      if (settled) {
        return;
      }
      settled = true;
      if (currentGreekUtterance === utterance) {
        currentGreekUtterance = null;
      }
      resolve(didSpeak);
    };

    utterance.onend = () => finish(true);
    utterance.onerror = () => finish(false);

    try {
      window.speechSynthesis.speak(utterance);
    } catch {
      finish(false);
    }
  });
}

async function speakGreekWithMp3(input: GreekAudioInput): Promise<void> {
  const audioUrl = await resolveGreekAudioUrl(input);
  if (!audioUrl) {
    return Promise.resolve();
  }

  stopGreekPlayback();

  return new Promise((resolve) => {
    const audio = new Audio(audioUrl);
    currentGreekAudio = audio;

    let settled = false;
    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      if (currentGreekAudio === audio) {
        currentGreekAudio = null;
      }
      resolve();
    };

    audio.onended = finish;
    audio.onerror = finish;
    void audio.play().catch(() => finish());
  });
}

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) {
    return null;
  }

  if (!audioContext) {
    audioContext = new AudioContextCtor();
  }

  if (audioContext.state === 'suspended') {
    void audioContext.resume().catch(() => undefined);
  }

  return audioContext;
}

function playTone(frequency: number, startOffset: number, duration: number, gainValue: number, type: OscillatorType): void {
  const context = getAudioContext();
  if (!context) {
    return;
  }

  const oscillator = context.createOscillator();
  const gainNode = context.createGain();
  const startTime = context.currentTime + startOffset;
  const stopTime = startTime + duration;

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startTime);

  gainNode.gain.setValueAtTime(0.0001, startTime);
  gainNode.gain.exponentialRampToValueAtTime(gainValue, startTime + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, stopTime);

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);
  oscillator.start(startTime);
  oscillator.stop(stopTime);
}

export function playCorrectSound(): void {
  playTone(659.25, 0, 0.12, 0.09, 'sine');
  playTone(830.61, 0.1, 0.16, 0.08, 'sine');
}

export function playWrongSound(): void {
  playTone(466.16, 0, 0.13, 0.095, 'square');
  playTone(349.23, 0.09, 0.19, 0.09, 'sawtooth');
}

export function playLessonFinishedSound(): void {
  playTone(523.25, 0, 0.12, 0.08, 'sine');
  playTone(659.25, 0.11, 0.12, 0.08, 'sine');
  playTone(783.99, 0.22, 0.15, 0.08, 'sine');
  playTone(1046.5, 0.34, 0.22, 0.1, 'sine');
}

export async function speakGreek(input: GreekAudioInput, mode: AudioMode = 'mp3'): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }

  if (mode === 'tts') {
    const didSpeak = await speakGreekWithTts(input);
    if (didSpeak) {
      return;
    }
  }

  return speakGreekWithMp3(input);
}
