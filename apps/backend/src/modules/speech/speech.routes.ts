import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { SpeechService } from './speech.service.js';

export async function registerSpeechRoutes(app: FastifyInstance, speech: SpeechService) {
  app.post('/api/speech/transcribe', async (request, reply) => {
    const data = await request.file();
    if (!data) {
      reply.code(400);
      return { error: 'Audio file is required.' };
    }

    const model = speech.normalizeModel(data.fields.model && 'value' in data.fields.model ? data.fields.model.value : undefined);
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vibeide-speech-'));
    const extension = path.extname(data.filename || '') || '.webm';
    const audioPath = path.join(tempDir, `audio${extension}`);

    try {
      await fs.writeFile(audioPath, await data.toBuffer());
      return await speech.transcribe(audioPath, model);
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  });
}
