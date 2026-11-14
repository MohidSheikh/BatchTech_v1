import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import compression from 'compression';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import {
  clientAcceptsBrotli,
  compressBufferBrotli,
  isTextAssetPath,
} from './src/utils/brotliCompression.ts';
import {
  buildRobotsTxt,
  buildSitemapXml,
  injectSeoOrigin,
  resolveCanonicalBaseUrl,
} from './src/utils/seoMetadata.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

const BROTLI_MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.cjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

async function sendTextResponse(
  req: Request,
  res: Response,
  contentType: string,
  body: string
) {
  res.setHeader('Vary', 'Accept-Encoding');
  if (clientAcceptsBrotli(req.headers['accept-encoding'])) {
    try {
      const br = await compressBufferBrotli(Buffer.from(body, 'utf8'));
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Encoding', 'br');
      res.send(br);
      return;
    } catch {
      // Fall back to uncompressed/gzip response on compression error
    }
  }
  res.type(contentType).send(body);
}

function getRequestBaseUrl(req: Request): string {
  const host = req.get('host');
  const fallback = host ? `${req.protocol}://${host}` : undefined;
  return resolveCanonicalBaseUrl(process.env.APP_URL, fallback);
}

export function createServerApp() {
  const app = express();

  app.set('trust proxy', true);
  app.use(compression());
  app.use(express.json({ limit: '32kb' }));

  app.get('/robots.txt', async (req: Request, res: Response) => {
    const baseUrl = getRequestBaseUrl(req);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    await sendTextResponse(req, res, 'text/plain; charset=utf-8', buildRobotsTxt(baseUrl));
  });

  app.get('/sitemap.xml', async (req: Request, res: Response) => {
    const baseUrl = getRequestBaseUrl(req);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    await sendTextResponse(req, res, 'application/xml; charset=utf-8', buildSitemapXml(baseUrl));
  });

  app.post('/api/contact', (_req: Request, res: Response) => {
    res.status(503).json({
      ok: false,
      disabled: true,
      message: 'Thank you for your interest in BatchTech. Our contact form will be available soon.',
    });
  });

  return app;
}

async function startServer() {
  const app = createServerApp();

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    const indexPath = path.join(distDir, 'index.html');
    const indexHtmlTemplate = fs.existsSync(indexPath)
      ? fs.readFileSync(indexPath, 'utf8')
      : '';

    app.use((req: Request, res: Response, next: NextFunction) => {
      if (
        (req.method !== 'GET' && req.method !== 'HEAD') ||
        !clientAcceptsBrotli(req.headers['accept-encoding'])
      ) {
        next();
        return;
      }
      const reqPath = req.path === '/' ? '/index.html' : req.path;
      const rel = reqPath.replace(/^\/+/, '');
      if (!rel || rel === 'index.html' || !isTextAssetPath(rel)) {
        next();
        return;
      }
      const resolvedFile = path.resolve(distDir, rel);
      if (!resolvedFile.startsWith(distDir + path.sep)) {
        next();
        return;
      }
      const brPath = `${resolvedFile}.br`;
      if (!fs.existsSync(brPath)) {
        next();
        return;
      }
      const ext = path.extname(resolvedFile).toLowerCase();
      const contentType = BROTLI_MIME_TYPES[ext];
      if (contentType) {
        res.setHeader('Content-Type', contentType);
      }
      res.setHeader('Content-Encoding', 'br');
      res.setHeader('Vary', 'Accept-Encoding');
      if (rel.startsWith('assets/')) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else {
        res.setHeader('Cache-Control', 'public, max-age=86400');
      }
      res.sendFile(brPath);
    });

    app.use(
      express.static(distDir, {
        index: false,
        setHeaders(res, filePath) {
          const rel = path.relative(distDir, filePath).replace(/\\/g, '/');
          if (rel.startsWith('assets/')) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          } else if (rel.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache');
          } else {
            res.setHeader('Cache-Control', 'public, max-age=86400');
          }
        },
      })
    );

    app.use(async (req, res) => {
      const baseUrl = getRequestBaseUrl(req);
      res.setHeader('Cache-Control', 'no-cache');
      if (indexHtmlTemplate) {
        await sendTextResponse(
          req,
          res,
          'text/html; charset=utf-8',
          injectSeoOrigin(indexHtmlTemplate, baseUrl)
        );
      } else {
        res.sendFile(indexPath);
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`BatchTech server listening on http://0.0.0.0:${PORT}`);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  startServer();
}
