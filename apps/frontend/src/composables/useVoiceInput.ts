import { ref } from 'vue';
import { speechApi } from '../services/speech.api';

export function useVoiceInput() {
  const isRecording = ref(false);
  const isTranscribing = ref(false);
  const error = ref<string | null>(null);

  let stream: MediaStream | null = null;
  let audioContext: AudioContext | null = null;
  let sourceNode: MediaStreamAudioSourceNode | null = null;
  let processorNode: ScriptProcessorNode | null = null;
  let chunks: Float32Array[] = [];
  let sampleRate = 16000;
  let onText: ((text: string) => void) | null = null;

  async function start(callback: (text: string) => void) {
    if (!navigator.mediaDevices?.getUserMedia || !audioContextConstructor()) {
      error.value = 'Voice input requires microphone and Web Audio support.';
      return;
    }

    error.value = null;
    onText = callback;
    chunks = [];
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const AudioContextClass = audioContextConstructor();
    audioContext = new AudioContextClass();
    sampleRate = audioContext.sampleRate;
    sourceNode = audioContext.createMediaStreamSource(stream);
    processorNode = audioContext.createScriptProcessor(4096, 1, 1);
    processorNode.onaudioprocess = (event) => {
      if (!isRecording.value) return;
      chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
    };
    sourceNode.connect(processorNode);
    processorNode.connect(audioContext.destination);
    isRecording.value = true;
  }

  function stop() {
    if (!isRecording.value) return;
    isRecording.value = false;
    processorNode?.disconnect();
    sourceNode?.disconnect();
    void audioContext?.close();
    stream?.getTracks().forEach((track) => track.stop());
    void transcribe();
  }

  async function toggle(callback: (text: string) => void) {
    if (isRecording.value) {
      stop();
      return;
    }

    await start(callback).catch((reason: Error) => {
      error.value = reason.message;
      cleanup();
    });
  }

  async function transcribe() {
    if (chunks.length === 0) {
      cleanup();
      return;
    }

    isTranscribing.value = true;
    try {
      const response = await speechApi.transcribe(encodeWav(mergeChunks(chunks), sampleRate), 'tiny');
      if (response.text) onText?.(response.text);
    } catch (reason) {
      error.value = reason instanceof Error ? reason.message : 'Speech transcription failed.';
    } finally {
      isTranscribing.value = false;
      cleanup();
    }
  }

  function cleanup() {
    processorNode = null;
    sourceNode = null;
    audioContext = null;
    chunks = [];
    onText = null;
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    isRecording.value = false;
  }

  return {
    isRecording,
    isTranscribing,
    error,
    toggle,
    stop
  };
}

function audioContextConstructor() {
  return window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
}

function mergeChunks(parts: Float32Array[]) {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const merged = new Float32Array(length);
  let offset = 0;
  for (const part of parts) {
    merged.set(part, offset);
    offset += part.length;
  }
  return merged;
}

function encodeWav(samples: Float32Array, sourceSampleRate: number) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sourceSampleRate, true);
  view.setUint32(28, sourceSampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (const sample of samples) {
    const value = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, value < 0 ? value * 0x8000 : value * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}
