import path from 'node:path';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import type { SpeechModelSize, SpeechTranscription } from './speech.types.js';

const require = createRequire(import.meta.url);
const { WaveFile } = require('wavefile') as { WaveFile: new (buffer?: Buffer | Uint8Array) => WaveFileInstance };
const supportedModels = new Set<SpeechModelSize>(['tiny', 'base']);
const modelIds: Record<SpeechModelSize, string> = {
  tiny: 'Xenova/whisper-tiny',
  base: 'Xenova/whisper-base'
};

type AsrPipeline = (audio: Float32Array, options?: { chunk_length_s?: number; stride_length_s?: number; task?: string }) => Promise<{ text: string }>;
type WaveFileInstance = {
  toBitDepth(bitDepth: string): void;
  toSampleRate(sampleRate: number): void;
  getSamples(): Float32Array | Float64Array | Array<Float32Array | Float64Array>;
};

export class SpeechService {
  private pipelines = new Map<SpeechModelSize, Promise<AsrPipeline>>();

  constructor(private readonly projectRoot: string) {}

  normalizeModel(model: unknown): SpeechModelSize {
    return supportedModels.has(model as SpeechModelSize) ? (model as SpeechModelSize) : 'tiny';
  }

  async transcribe(audioPath: string, model: SpeechModelSize): Promise<SpeechTranscription> {
    const transcriber = await this.pipeline(model);
    const audio = await this.readWavAudio(audioPath);
    const output = await transcriber(audio, {
      chunk_length_s: 30,
      stride_length_s: 5,
      task: 'transcribe'
    });

    return {
      text: output.text.trim(),
      language: null,
      duration: null,
      model
    };
  }

  private pipeline(model: SpeechModelSize) {
    const existing = this.pipelines.get(model);
    if (existing) return existing;

    const next = this.createPipeline(model);
    this.pipelines.set(model, next);
    return next;
  }

  private async createPipeline(model: SpeechModelSize): Promise<AsrPipeline> {
    const transformers = await import('@huggingface/transformers');
    transformers.env.cacheDir = process.env.VIBEIDE_MODEL_CACHE ?? path.join(this.projectRoot, '.cache', 'models');
    transformers.env.allowLocalModels = true;
    transformers.env.allowRemoteModels = true;

    return transformers.pipeline('automatic-speech-recognition', modelIds[model], {
      dtype: 'q8'
    }) as Promise<AsrPipeline>;
  }

  private async readWavAudio(audioPath: string) {
    const buffer = await fs.readFile(audioPath);
    let wav: WaveFileInstance;

    try {
      wav = new WaveFile(buffer);
    } catch {
      throw Object.assign(new Error('Unsupported audio format. Please send WAV audio.'), { statusCode: 400 });
    }

    wav.toBitDepth('32f');
    wav.toSampleRate(16000);
    let samples = wav.getSamples();

    if (Array.isArray(samples)) {
      if (samples.length > 1) {
        const mixed = new Float32Array(samples[0].length);
        for (let index = 0; index < mixed.length; index += 1) {
          let value = 0;
          for (const channel of samples) value += channel[index] ?? 0;
          mixed[index] = value / samples.length;
        }
        return mixed;
      }

      return new Float32Array(samples[0]);
    }

    return new Float32Array(samples);
  }
}
