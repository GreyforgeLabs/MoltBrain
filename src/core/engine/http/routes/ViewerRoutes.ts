import express, { type Application } from 'express';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { type RouteHandler } from '../../../api/Server.js';
import { type DatabaseManager } from '../../DatabaseManager.js';
import { type SessionManager } from '../../SessionManager.js';
import { type SSEBroadcaster } from '../../SSEBroadcaster.js';
import { resolvePluginRoot } from '../paths.js';
import { RouteBase } from './RouteBase.js';

export class ViewerRoutes extends RouteBase implements RouteHandler {
  constructor(
    private readonly sseBroadcaster: SSEBroadcaster,
    private readonly dbManager: DatabaseManager,
    private readonly sessionManager: SessionManager,
  ) {
    super();
  }

  setupRoutes(app: Application): void {
    const root = resolvePluginRoot();
    const staticCandidates = [
      join(root, 'plugin', 'ui'),
      join(root, 'ui'),
      join(root, '..', 'plugin', 'ui'),
    ];
    const staticDir = staticCandidates.find(candidate => existsSync(candidate)) || staticCandidates[0];

    app.use(express.static(staticDir));
    app.get('/health', this.handleHealth);
    app.get('/', this.handleViewerUI);
    app.get('/stream', this.handleSSEStream);
  }

  private readonly handleHealth = this.wrapHandler((_req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  private readonly handleViewerUI = this.wrapHandler((_req, res) => {
    const root = resolvePluginRoot();
    const viewerPath = [
      join(root, 'ui', 'viewer.html'),
      join(root, 'plugin', 'ui', 'viewer.html'),
    ].find(candidate => existsSync(candidate));

    if (!viewerPath) {
      throw new Error('Viewer UI not found at any expected location');
    }

    res.setHeader('Content-Type', 'text/html');
    res.send(readFileSync(viewerPath, 'utf-8'));
  });

  private readonly handleSSEStream = this.wrapHandler((_req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    this.sseBroadcaster.addClient(res);

    if (!this.dbManager.isInitialized()) {
      res.write(`data: ${JSON.stringify({
        type: 'error',
        message: 'Database not initialized. Please wait for initialization to complete.',
      })}\n\n`);
      res.end();
      return;
    }

    this.sseBroadcaster.broadcast({
      type: 'initial_load',
      projects: this.dbManager.getSessionStore().getAllProjects(),
      timestamp: Date.now(),
    } as any);

    this.sseBroadcaster.broadcast({
      type: 'processing_status',
      isProcessing: this.sessionManager.isAnySessionProcessing(),
      queueDepth: this.sessionManager.getTotalActiveWork(),
    } as any);
  });
}
