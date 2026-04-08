import { type Application, type Request } from 'express';
import { existsSync, readFileSync, statSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { getWorkerPort } from '../../../../common/engine-utils.js';
import { logger } from '../../../../utils/logger.js';
import { type RouteHandler } from '../../../api/Server.js';
import { type WorkerService } from '../../../engine-service.js';
import { type PaginationHelper } from '../../PaginationHelper.js';
import { type DatabaseManager } from '../../DatabaseManager.js';
import { type SessionManager } from '../../SessionManager.js';
import { type SSEBroadcaster } from '../../SSEBroadcaster.js';
import { PendingMessageStore } from '../../../storage/PendingMessageStore.js';
import { resolvePluginRoot } from '../paths.js';
import { RouteBase } from './RouteBase.js';

export class DataRoutes extends RouteBase implements RouteHandler {
  constructor(
    private readonly paginationHelper: PaginationHelper,
    private readonly dbManager: DatabaseManager,
    private readonly sessionManager: SessionManager,
    private readonly sseBroadcaster: SSEBroadcaster,
    private readonly workerService: WorkerService,
    private readonly startTime: number,
  ) {
    super();
  }

  setupRoutes(app: Application): void {
    app.get('/api/observations', this.handleGetObservations);
    app.get('/api/summaries', this.handleGetSummaries);
    app.get('/api/prompts', this.handleGetPrompts);
    app.get('/api/observation/:id', this.handleGetObservationById);
    app.post('/api/observations/batch', this.handleGetObservationsByIds);
    app.get('/api/session/:id', this.handleGetSessionById);
    app.post('/api/sdk-sessions/batch', this.handleGetSdkSessionsByIds);
    app.get('/api/prompt/:id', this.handleGetPromptById);
    app.get('/api/stats', this.handleGetStats);
    app.get('/api/projects', this.handleGetProjects);
    app.get('/api/processing-status', this.handleGetProcessingStatus);
    app.post('/api/processing', this.handleSetProcessing);
    app.get('/api/pending-queue', this.handleGetPendingQueue);
    app.post('/api/pending-queue/process', this.handleProcessPendingQueue);
    app.delete('/api/pending-queue/failed', this.handleClearFailedQueue);
    app.delete('/api/pending-queue/all', this.handleClearAllQueue);
    app.post('/api/import', this.handleImport);
  }

  private parsePaginationParams(req: Request): { offset: number; limit: number; project?: string } {
    const offset = parseInt(String(req.query.offset ?? 0), 10) || 0;
    const limit = Math.min(parseInt(String(req.query.limit ?? 20), 10) || 20, 100);
    const project = typeof req.query.project === 'string' ? req.query.project : undefined;
    return { offset, limit, project };
  }

  private readonly handleGetObservations = this.wrapHandler((req, res) => {
    if (!this.dbManager.isInitialized()) {
      res.status(503).json({ error: 'Database not initialized. Please wait for initialization to complete.' });
      return;
    }

    const { offset, limit, project } = this.parsePaginationParams(req);
    res.json(this.paginationHelper.getObservations(offset, limit, project));
  });

  private readonly handleGetSummaries = this.wrapHandler((req, res) => {
    if (!this.dbManager.isInitialized()) {
      res.status(503).json({ error: 'Database not initialized. Please wait for initialization to complete.' });
      return;
    }

    const { offset, limit, project } = this.parsePaginationParams(req);
    res.json(this.paginationHelper.getSummaries(offset, limit, project));
  });

  private readonly handleGetPrompts = this.wrapHandler((req, res) => {
    if (!this.dbManager.isInitialized()) {
      res.status(503).json({ error: 'Database not initialized. Please wait for initialization to complete.' });
      return;
    }

    const { offset, limit, project } = this.parsePaginationParams(req);
    res.json(this.paginationHelper.getPrompts(offset, limit, project));
  });

  private readonly handleGetObservationById = this.wrapHandler((req, res) => {
    if (!this.dbManager.isInitialized()) {
      res.status(503).json({ error: 'Database not initialized. Please wait for initialization to complete.' });
      return;
    }

    const id = this.parseIntParam(req, res, 'id');
    if (id === null) {
      return;
    }

    const observation = this.dbManager.getSessionStore().getObservationById(id);
    if (!observation) {
      this.notFound(res, `Observation #${id} not found`);
      return;
    }

    res.json(observation);
  });

  private readonly handleGetObservationsByIds = this.wrapHandler((req, res) => {
    if (!this.dbManager.isInitialized()) {
      res.status(503).json({ error: 'Database not initialized. Please wait for initialization to complete.' });
      return;
    }

    const { ids, orderBy, limit, project } = req.body as {
      ids?: unknown[];
      orderBy?: string;
      limit?: number;
      project?: string;
    };

    if (!Array.isArray(ids)) {
      this.badRequest(res, 'ids must be an array of numbers');
      return;
    }

    if (ids.length === 0) {
      res.json([]);
      return;
    }

    if (!ids.every(id => typeof id === 'number' && Number.isInteger(id))) {
      this.badRequest(res, 'All ids must be integers');
      return;
    }

    res.json(this.dbManager.getSessionStore().getObservationsByIds(ids, { orderBy, limit, project }));
  });

  private readonly handleGetSessionById = this.wrapHandler((req, res) => {
    if (!this.dbManager.isInitialized()) {
      res.status(503).json({ error: 'Database not initialized. Please wait for initialization to complete.' });
      return;
    }

    const id = this.parseIntParam(req, res, 'id');
    if (id === null) {
      return;
    }

    const sessions = this.dbManager.getSessionStore().getSessionSummariesByIds([id]);
    if (sessions.length === 0) {
      this.notFound(res, `Session #${id} not found`);
      return;
    }

    res.json(sessions[0]);
  });

  private readonly handleGetSdkSessionsByIds = this.wrapHandler((req, res) => {
    if (!this.dbManager.isInitialized()) {
      res.status(503).json({ error: 'Database not initialized. Please wait for initialization to complete.' });
      return;
    }

    const { memorySessionIds } = req.body as { memorySessionIds?: string[] };
    if (!Array.isArray(memorySessionIds)) {
      this.badRequest(res, 'memorySessionIds must be an array');
      return;
    }

    res.json(this.dbManager.getSessionStore().getSdkSessionsBySessionIds(memorySessionIds));
  });

  private readonly handleGetPromptById = this.wrapHandler((req, res) => {
    if (!this.dbManager.isInitialized()) {
      res.status(503).json({ error: 'Database not initialized. Please wait for initialization to complete.' });
      return;
    }

    const id = this.parseIntParam(req, res, 'id');
    if (id === null) {
      return;
    }

    const prompts = this.dbManager.getSessionStore().getUserPromptsByIds([id]);
    if (prompts.length === 0) {
      this.notFound(res, `Prompt #${id} not found`);
      return;
    }

    res.json(prompts[0]);
  });

  private readonly handleGetStats = this.wrapHandler((_req, res) => {
    if (!this.dbManager.isInitialized()) {
      res.status(503).json({ error: 'Database not initialized. Please wait for initialization to complete.' });
      return;
    }

    const db = this.dbManager.getSessionStore().db;
    const packageJsonPath = join(resolvePluginRoot(), 'package.json');
    const version = JSON.parse(readFileSync(packageJsonPath, 'utf-8')).version;

    const observations = db.prepare('SELECT COUNT(*) as count FROM observations').get() as { count: number };
    const sessions = db.prepare('SELECT COUNT(*) as count FROM sdk_sessions').get() as { count: number };
    const summaries = db.prepare('SELECT COUNT(*) as count FROM session_summaries').get() as { count: number };

    const databasePath = join(homedir(), '.claude-recall', 'claude-recall.db');
    const databaseSize = existsSync(databasePath) ? statSync(databasePath).size : 0;

    res.json({
      worker: {
        version,
        uptime: Math.floor((Date.now() - this.startTime) / 1000),
        activeSessions: this.sessionManager.getActiveSessionCount(),
        sseClients: this.sseBroadcaster.getClientCount(),
        port: getWorkerPort(),
      },
      database: {
        path: databasePath,
        size: databaseSize,
        observations: observations.count,
        sessions: sessions.count,
        summaries: summaries.count,
      },
    });
  });

  private readonly handleGetProjects = this.wrapHandler((_req, res) => {
    if (!this.dbManager.isInitialized()) {
      res.status(503).json({ error: 'Database not initialized. Please wait for initialization to complete.' });
      return;
    }

    const projects = this.dbManager.getSessionStore().db.prepare(`
      SELECT DISTINCT project
      FROM observations
      WHERE project IS NOT NULL
      GROUP BY project
      ORDER BY MAX(created_at_epoch) DESC
    `).all().map((row: { project: string }) => row.project);

    res.json({ projects });
  });

  private readonly handleGetProcessingStatus = this.wrapHandler((_req, res) => {
    res.json({
      isProcessing: this.sessionManager.isAnySessionProcessing(),
      queueDepth: this.sessionManager.getTotalActiveWork(),
    });
  });

  private readonly handleSetProcessing = this.wrapHandler((_req, res) => {
    this.workerService.broadcastProcessingStatus();
    res.json({
      status: 'ok',
      isProcessing: this.sessionManager.isAnySessionProcessing(),
      queueDepth: this.sessionManager.getTotalQueueDepth(),
      activeSessions: this.sessionManager.getActiveSessionCount(),
    });
  });

  private readonly handleImport = this.wrapHandler((req, res) => {
    if (!this.dbManager.isInitialized()) {
      res.status(503).json({ error: 'Database not initialized. Please wait for initialization to complete.' });
      return;
    }

    const {
      sessions,
      summaries,
      observations,
      prompts,
    } = req.body as {
      sessions?: any[];
      summaries?: any[];
      observations?: any[];
      prompts?: any[];
    };

    const stats = {
      sessionsImported: 0,
      sessionsSkipped: 0,
      summariesImported: 0,
      summariesSkipped: 0,
      observationsImported: 0,
      observationsSkipped: 0,
      promptsImported: 0,
      promptsSkipped: 0,
    };
    const sessionStore = this.dbManager.getSessionStore();

    if (Array.isArray(sessions)) {
      for (const session of sessions) {
        sessionStore.importSdkSession(session).imported ? stats.sessionsImported++ : stats.sessionsSkipped++;
      }
    }
    if (Array.isArray(summaries)) {
      for (const summary of summaries) {
        sessionStore.importSessionSummary(summary).imported ? stats.summariesImported++ : stats.summariesSkipped++;
      }
    }
    if (Array.isArray(observations)) {
      for (const observation of observations) {
        sessionStore.importObservation(observation).imported ? stats.observationsImported++ : stats.observationsSkipped++;
      }
    }
    if (Array.isArray(prompts)) {
      for (const prompt of prompts) {
        sessionStore.importUserPrompt(prompt).imported ? stats.promptsImported++ : stats.promptsSkipped++;
      }
    }

    res.json({ success: true, stats });
  });

  private readonly handleGetPendingQueue = this.wrapHandler((_req, res) => {
    if (!this.dbManager.isInitialized()) {
      res.status(503).json({ error: 'Database not initialized. Please wait for initialization to complete.' });
      return;
    }

    const pendingStore = new PendingMessageStore(this.dbManager.getSessionStore().db, 3);
    const messages = pendingStore.getQueueMessages();
    const recentlyProcessed = pendingStore.getRecentlyProcessed(20, 30);
    const stuckCount = pendingStore.getStuckCount(300_000);
    const sessionsWithPendingWork = pendingStore.getSessionsWithPendingMessages();

    res.json({
      queue: {
        messages,
        totalPending: messages.filter(message => message.status === 'pending').length,
        totalProcessing: messages.filter(message => message.status === 'processing').length,
        totalFailed: messages.filter(message => message.status === 'failed').length,
        stuckCount,
      },
      recentlyProcessed,
      sessionsWithPendingWork,
    });
  });

  private readonly handleProcessPendingQueue = this.wrapHandler(async (req, res) => {
    const sessionLimit = Math.min(Math.max(parseInt(String(req.body.sessionLimit ?? 10), 10) || 10, 1), 100);
    const result = await this.workerService.processPendingQueues(sessionLimit);
    res.json({ success: true, ...result });
  });

  private readonly handleClearFailedQueue = this.wrapHandler((_req, res) => {
    if (!this.dbManager.isInitialized()) {
      res.status(503).json({ error: 'Database not initialized. Please wait for initialization to complete.' });
      return;
    }

    const clearedCount = new PendingMessageStore(this.dbManager.getSessionStore().db, 3).clearFailed();
    logger.info('SESSION', 'Cleared failed queue messages', { clearedCount });
    res.json({ success: true, clearedCount });
  });

  private readonly handleClearAllQueue = this.wrapHandler((_req, res) => {
    if (!this.dbManager.isInitialized()) {
      res.status(503).json({ error: 'Database not initialized. Please wait for initialization to complete.' });
      return;
    }

    const clearedCount = new PendingMessageStore(this.dbManager.getSessionStore().db, 3).clearAll();
    logger.warn('SESSION', 'Cleared ALL queue messages (pending, processing, failed)', { clearedCount });
    res.json({ success: true, clearedCount });
  });
}
