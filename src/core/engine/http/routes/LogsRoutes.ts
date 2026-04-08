import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { type Application } from 'express';
import { SettingsDefaultsManager } from '../../../../common/SettingsDefaultsManager.js';
import { logger } from '../../../../utils/logger.js';
import { type RouteHandler } from '../../../api/Server.js';
import { RouteBase } from './RouteBase.js';

export class LogsRoutes extends RouteBase implements RouteHandler {
  private getLogsDir(): string {
    const dataDir = SettingsDefaultsManager.get('MOLTBRAIN_DATA_DIR');
    return join(dataDir, 'logs');
  }

  private getLogFilePath(): string {
    const date = new Date().toISOString().split('T')[0];
    return join(this.getLogsDir(), `claude-recall-${date}.log`);
  }

  setupRoutes(app: Application): void {
    app.get('/api/logs', this.handleGetLogs);
    app.post('/api/logs/clear', this.handleClearLogs);
  }

  private readonly handleGetLogs = this.wrapHandler((req, res) => {
    const logFilePath = this.getLogFilePath();
    if (!existsSync(logFilePath)) {
      res.json({ logs: '', path: logFilePath, exists: false });
      return;
    }

    const requestedLines = parseInt(String(req.query.lines ?? 1000), 10);
    const maxLines = Math.min(requestedLines, 10_000);
    const lines = readFileSync(logFilePath, 'utf-8').split('\n');
    const startIndex = Math.max(0, lines.length - maxLines);
    const logs = lines.slice(startIndex).join('\n');

    res.json({
      logs,
      path: logFilePath,
      exists: true,
      totalLines: lines.length,
      returnedLines: lines.length - startIndex,
    });
  });

  private readonly handleClearLogs = this.wrapHandler((_req, res) => {
    const logFilePath = this.getLogFilePath();
    if (!existsSync(logFilePath)) {
      res.json({ success: true, message: 'Log file does not exist', path: logFilePath });
      return;
    }

    writeFileSync(logFilePath, '', 'utf-8');
    logger.info('SYSTEM', 'Log file cleared via UI', { path: logFilePath });
    res.json({ success: true, message: 'Log file cleared', path: logFilePath });
  });
}
