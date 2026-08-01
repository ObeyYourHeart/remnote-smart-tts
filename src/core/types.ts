export type SupportedLanguage = 'zh' | 'en' | 'ja';

export type SpeechProvider = 'browser' | 'azure';

export type InterfaceLanguage = 'en' | 'zh';

export type AutoplayMode = 'off' | 'question' | 'answer' | 'both';

export interface LanguageVoiceMap {
  zh: string;
  en: string;
  ja: string;
}

export interface SpeechSettings {
  uiLanguage: InterfaceLanguage;
  enabled: boolean;
  autoReadQuestion: boolean;
  autoReadAnswer: boolean;
  provider: SpeechProvider;
  fallbackToBrowser: boolean;
  defaultLanguage: SupportedLanguage;
  rate: number;
  volume: number;
  browserVoices: LanguageVoiceMap;
  azureRegion: string;
  azureVoices: LanguageVoiceMap;
  clozeWords: LanguageVoiceMap;
}

export interface SpeechContent {
  text: string;
  language: SupportedLanguage;
  /** Optional semantic units that should be spoken with a clear boundary. */
  segments?: SpeechSegment[];
}

/** One independently voiced semantic unit inside a single playback plan. */
export interface SpeechSegment {
  text: string;
  language: SupportedLanguage;
}

export type SupportedCardKind =
  | 'forward'
  | 'backward'
  | 'concept-forward'
  | 'concept-backward'
  | 'descriptor-forward'
  | 'descriptor-backward'
  | 'multi-line-forward'
  | 'multi-line-backward'
  | 'list-answer-forward'
  | 'list-answer-backward'
  | 'cloze';

export interface CardSpeechPlan {
  cardId: string;
  remId: string;
  kind: SupportedCardKind;
  question: SpeechContent;
  answer: SpeechContent;
  /** Local planning facts used by the localhost runtime regression harness. */
  diagnostics?: Record<string, string | number | boolean>;
}

export interface RichTextPiece {
  text: string;
  clozeId?: string;
}

export interface RenderedCloze {
  questionText: string;
  answerText: string;
  placeholderLanguage: SupportedLanguage;
}

export type SpeechStatus = 'idle' | 'loading' | 'preparing' | 'speaking' | 'error';

export interface SpeechPlaybackCallbacks {
  onPlaybackStart?: () => void;
}

export interface SpeechPlaybackResult {
  provider: SpeechProvider;
  fallbackReason?: string;
  /** Safe, credential-redacted SDK detail exposed only by localhost diagnostics. */
  diagnosticReason?: string;
}
