export type SpeechModelSize = 'tiny' | 'base';

export type SpeechTranscription = {
  text: string;
  language?: string | null;
  duration?: number | null;
  model: SpeechModelSize;
};
