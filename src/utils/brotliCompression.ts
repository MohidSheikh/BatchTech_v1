import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import zlib from 'node:zlib';
import type { Plugin, ResolvedConfig } from 'vite';

const brotliCompressAsync = promisify(zlib.brotliCompress);

export const TEXT_ASSET_EXTENSIONS = new Set([
  '.html',
  '.htm',
  '.js',
  '.mjs',
  '.cjs',
  '.css',
  '.svg',
  '.json',
  '.xml',
  '.txt',
  '.webmanifest',
  '.map',
]);

export function isTextAssetPath(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return TEXT_ASSET_EXTENSIONS.has(ext);
}

export async function compressBufferBrotli(input: Buffer): Promise<Buffer> {
  return brotliCompressAsync(input, {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: zlib.constants.BROTLI_MAX_QUALITY,
      [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
      [zlib.constants.BROTLI_PARAM_SIZE_HINT]: input.length,
    },
  });
}

export function clientAcceptsBrotli(acceptEncodingHeader?: string | string[]): boolean {
  if (!acceptEncodingHeader) return false;
  const raw = Array.isArray(acceptEncodingHeader)
    ? acceptEncodingHeader.join(',')
    : acceptEncodingHeader;
  const parts = raw.split(',');
  for (const part of parts) {
    const [encodingRaw, ...params] = part.trim().toLowerCase().split(';');
    if (encodingRaw.trim() !== 'br') continue;
    let q = 1;
    for (const param of params) {
      const [k, v] = param.trim().split('=');
      if (k === 'q' && v !== undefined) {
        const parsed = Number(v);
        if (!Number.isNaN(parsed)) q = parsed;
      }
    }
    return q > 0;
  }
  return false;
}

async function collectFilesRecursively(dir: string): Promise<string[]> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFilesRecursively(fullPath)));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

export async function compressDirectoryTextAssetsBrotli(
  outDir: string
): Promise<{ compressedCount: number; originalBytes: number; brotliBytes: number }> {
  const allFiles = await collectFilesRecursively(outDir);
  const textFiles = allFiles.filter((filePath) => isTextAssetPath(filePath));

  let compressedCount = 0;
  let originalBytes = 0;
  let brotliBytes = 0;

  await Promise.all(
    textFiles.map(async (filePath) => {
      const raw = await fs.readFile(filePath);
      if (raw.length === 0) return;
      const compressed = await compressBufferBrotli(raw);
      await fs.writeFile(`${filePath}.br`, compressed);
      compressedCount += 1;
      originalBytes += raw.length;
      brotliBytes += compressed.length;
    })
  );

  return { compressedCount, originalBytes, brotliBytes };
}

export function brotliVitePlugin(): Plugin {
  let outDir = '';
  return {
    name: 'batchtech-brotli-compression',
    apply: 'build',
    configResolved(config: ResolvedConfig) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    async closeBundle() {
      if (!outDir) return;
      await compressDirectoryTextAssetsBrotli(outDir);
    },
  };
}
