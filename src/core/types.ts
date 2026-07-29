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
}

export type SupportedCardKind = 'forward' | 'backward' | 'descriptor-backward' | 'cloze';

export interface CardSpeechPlan {
  cardId: string;
  remId: string;
  kind: SupportedCardKind;
  question: SpeechContent;
  answer: SpeechContent;
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

export type SpeechStatus = 'idle' | 'loading' | 'speaking' | 'error';

export interface SpeechPlaybackResult {
  provider: SpeechProvider;
  fallbackReason?: string;
}
