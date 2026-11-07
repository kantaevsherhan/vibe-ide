import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

export async function writeAtomicJson(filePath: string, value: unknown) {
  const temporary = `${filePath}.${crypto.randomUUID()}.tmp`;
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  try {
    await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
    for (let attempt = 0; ; attempt++) {
      try {
        await fs.rename(temporary, filePath);
        return;
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        // Windows readers and indexers may briefly lock a destination during replacement.
        if (process.platform !== 'win32' || !['EPERM', 'EACCES', 'EBUSY'].includes(code || '') || attempt >= 7) throw error;
        await delay(Math.min(20 * 2 ** attempt, 200));
      }
    }
  } finally {
    await fs.rm(temporary, { force: true }).catch(() => {});
  }
}
