import { apiUrl, getApiAuthToken } from './api';

export type SpeechModelSize = 'tiny' | 'base';

export type SpeechTranscription = {
  text: string;
  language?: string | null;
  duration?: number | null;
  model: SpeechModelSize;
};

export const speechApi = {
  async transcribe(audio: Blob, model: SpeechModelSize = 'tiny') {
    const formData = new FormData();
    formData.append('audio', audio, `voice.${audio.type.includes('wav') ? 'wav' : audio.type.includes('mp4') ? 'mp4' : 'webm'}`);
    formData.append('model', model);

    const token = getApiAuthToken();
    const response = await fetch(apiUrl('/api/speech/transcribe'), {
      method: 'POST',
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: formData
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;
      throw new Error(payload?.message ?? payload?.error ?? `Speech transcription failed: ${response.status}`);
    }

    return response.json() as Promise<SpeechTranscription>;
  }
};
