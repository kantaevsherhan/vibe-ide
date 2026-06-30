import fs from 'node:fs/promises';
import path from 'node:path';

const dangerRoots = [
  '/etc',
  '/root',
  '/home',
  '/usr',
  '/var',
  'C:\\Windows',
  'C:\\Users'
].map((entry) => path.resolve(entry).toLowerCase());

export class SafePathError extends Error {
  statusCode = 400;
}

export function safePath(workspaceRoot: string, relativePath = '') {
  const normalizedInput = relativePath.replaceAll('\\', '/');

  if (normalizedInput.includes('../') || normalizedInput === '..' || normalizedInput.startsWith('../')) {
    throw new SafePathError('Parent directory paths are not allowed.');
  }

  if (path.isAbsolute(normalizedInput)) {
    throw new SafePathError('Absolute paths are not allowed.');
  }

  const root = path.resolve(workspaceRoot);
  const resolved = path.resolve(root, normalizedInput);
  const relative = path.relative(root, resolved);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new SafePathError('Path escapes the workspace.');
  }

  for (const dangerRoot of dangerRoots) {
    if (resolved.toLowerCase() === dangerRoot || resolved.toLowerCase().startsWith(`${dangerRoot}${path.sep}`)) {
      throw new SafePathError('System paths are not allowed.');
    }
  }

  return resolved;
}

export async function assertReadableTextFile(filePath: string, maxFileSizeBytes: number) {
  const stats = await fs.stat(filePath);
  if (!stats.isFile()) {
    throw Object.assign(new Error('Path is not a file.'), { statusCode: 400 });
  }

  if (stats.size > maxFileSizeBytes) {
    throw Object.assign(new Error('File is too large to read.'), { statusCode: 413 });
  }

  const handle = await fs.open(filePath, 'r');
  try {
    const sample = Buffer.alloc(Math.min(stats.size, 4096));
    await handle.read(sample, 0, sample.length, 0);
    if (sample.includes(0)) {
      throw Object.assign(new Error('Binary files cannot be opened as text.'), { statusCode: 415 });
    }
  } finally {
    await handle.close();
  }

  return stats;
}

export async function assertWritableFileTarget(filePath: string, content: string, maxFileSizeBytes: number) {
  if (Buffer.byteLength(content, 'utf8') > maxFileSizeBytes) {
    throw Object.assign(new Error('File content exceeds the configured size limit.'), { statusCode: 413 });
  }

  try {
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) {
      throw Object.assign(new Error('Cannot overwrite a directory.'), { statusCode: 400 });
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}
