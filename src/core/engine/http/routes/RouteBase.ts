import type { Request, Response } from 'express';
import { logger } from '../../../../utils/logger.js';

export class RouteBase {
  protected wrapHandler<T extends Request = Request>(handler: (req: T, res: Response) => void | Promise<void>) {
    return (req: T, res: Response): void => {
      try {
        const result = handler(req, res);
        if (result instanceof Promise) {
          result.catch(error => this.handleError(res, error));
        }
      } catch (error) {
        logger.error('HTTP', 'Route handler error', { path: req.path }, error as Error);
        this.handleError(res, error);
      }
    };
  }

  protected parseIntParam(req: Request, res: Response, param: string): number | null {
    const value = parseInt(String(req.params[param]), 10);
    if (Number.isNaN(value)) {
      this.badRequest(res, `Invalid ${param}`);
      return null;
    }
    return value;
  }

  protected validateRequired(req: Request, res: Response, fields: string[]): boolean {
    for (const field of fields) {
      if (req.body[field] === undefined || req.body[field] === null) {
        this.badRequest(res, `Missing ${field}`);
        return false;
      }
    }
    return true;
  }

  protected badRequest(res: Response, error: string): void {
    res.status(400).json({ error });
  }

  protected notFound(res: Response, error: string): void {
    res.status(404).json({ error });
  }

  protected handleError(res: Response, error: unknown, message: string = 'Request failed'): void {
    const resolvedError = error instanceof Error ? error : new Error(String(error));
    logger.failure('WORKER', message, {}, resolvedError);
    if (!res.headersSent) {
      res.status(500).json({ error: resolvedError.message });
    }
  }
}
