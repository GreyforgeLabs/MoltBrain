import express, { type NextFunction, type Request, type RequestHandler, type Response } from 'express';
import { logger } from '../../../utils/logger.js';
import { resolvePluginPath } from './paths.js';

export function summarizeRequestBody(_method: string, path: string, body: unknown): string {
  if (!body || typeof body !== 'object' || Object.keys(body as Record<string, unknown>).length === 0 || path.includes('/init')) {
    return '';
  }

  if (path.includes('/observations')) {
    const requestBody = body as Record<string, unknown>;
    const toolName = typeof requestBody.tool_name === 'string' ? requestBody.tool_name : '?';
    return `tool=${logger.formatTool(toolName, requestBody.tool_input)}`;
  }

  if (path.includes('/summarize')) {
    return 'requesting summary';
  }

  return '';
}

function allowAllOrigins(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');

  if (_req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }

  next();
}

function requestLogger(
  summarizeBody: (method: string, path: string, body: unknown) => string
): RequestHandler {
  return (req, res, next) => {
    const isStaticAsset = ['.html', '.js', '.css', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.woff', '.woff2', '.ttf', '.eot']
      .some(ext => req.path.endsWith(ext));
    const isLogsRoute = req.path === '/api/logs';

    if (req.path.startsWith('/health') || req.path === '/' || isStaticAsset || isLogsRoute) {
      next();
      return;
    }

    const startTime = Date.now();
    const requestId = `${req.method}-${Date.now()}`;
    const bodySummary = summarizeBody(req.method, req.path, req.body);

    logger.info('HTTP', `-> ${req.method} ${req.path}`, { requestId }, bodySummary);

    const originalSend = res.send.bind(res);
    res.send = ((body?: unknown) => {
      logger.info('HTTP', `<- ${res.statusCode} ${req.path}`, {
        requestId,
        duration: `${Date.now() - startTime}ms`,
      });
      return originalSend(body as any);
    }) as Response['send'];

    next();
  };
}

export function createMiddleware(
  summarizeBody: (method: string, path: string, body: unknown) => string
): RequestHandler[] {
  return [
    express.json({ limit: '50mb' }),
    allowAllOrigins,
    requestLogger(summarizeBody),
    express.static(resolvePluginPath('extension', 'web')),
  ];
}

export function requireLocalhost(req: Request, res: Response, next: NextFunction): void {
  const clientIp = req.ip || req.connection.remoteAddress || '';
  const isLocalhost = clientIp === '127.0.0.1'
    || clientIp === '::1'
    || clientIp === '::ffff:127.0.0.1'
    || clientIp === 'localhost';

  if (!isLocalhost) {
    logger.warn('SYSTEM', 'Admin endpoint access denied - not localhost', {
      endpoint: req.path,
      clientIp,
      method: req.method,
    });
    res.status(403).json({
      error: 'Forbidden',
      message: 'Admin endpoints are only accessible from localhost',
    });
    return;
  }

  next();
}
