import { type Application } from 'express';
import { SettingsDefaultsManager } from '../../../../common/SettingsDefaultsManager.js';
import { USER_SETTINGS_PATH } from '../../../../common/paths.js';
import { getWorkerPort } from '../../../../common/engine-utils.js';
import { logger } from '../../../../utils/logger.js';
import { type RouteHandler } from '../../../api/Server.js';
import { type WorkerService } from '../../../engine-service.js';
import { type DatabaseManager } from '../../DatabaseManager.js';
import { type GeminiAgent } from '../../GeminiAgent.js';
import { isGeminiAvailable, isGeminiSelected } from '../../GeminiAgent.js';
import { type OpenRouterAgent } from '../../OpenRouterAgent.js';
import { isOpenRouterAvailable, isOpenRouterSelected } from '../../OpenRouterAgent.js';
import { type SDKAgent } from '../../SDKAgent.js';
import { type SessionManager } from '../../SessionManager.js';
import { type SessionEventBroadcaster } from '../../events/SessionEventBroadcaster.js';
import { SessionCompletionHandler } from '../../session/SessionCompletionHandler.js';
import { RouteBase } from './RouteBase.js';

function countPrivateTags(content: string): number {
  const privateCount = (content.match(/<private>/g) || []).length;
  const contextCount = (content.match(/<claude-recall-context>/g) || []).length;
  return privateCount + contextCount;
}

function stripPrivateTags(content: string): string {
  const tagCount = countPrivateTags(content);
  if (tagCount > 100) {
    logger.warn('SYSTEM', 'tag count exceeds limit', {
      tagCount,
      maxAllowed: 100,
      contentLength: content.length,
    });
  }

  return content
    .replace(/<claude-recall-context>[\s\S]*?<\/claude-recall-context>/g, '')
    .replace(/<private>[\s\S]*?<\/private>/g, '')
    .trim();
}

function sanitizeUserPrompt(prompt: string): string {
  return stripPrivateTags(prompt);
}

function sanitizeToolPayload(payload: string): string {
  return stripPrivateTags(payload);
}

function getSkipTools(): Set<string> {
  const settings = SettingsDefaultsManager.loadFromFile(USER_SETTINGS_PATH) as Record<string, string | undefined>;
  const raw = settings.CLAUDE_RECALL_SKIP_TOOLS || settings.MOLTBRAIN_SKIP_TOOLS || '';
  return new Set(raw.split(',').map(value => value.trim()).filter(Boolean));
}

function ensureUserPromptIsPublic(
  sessionStore: ReturnType<DatabaseManager['getSessionStore']>,
  contentSessionId: string,
  promptNumber: number,
  lane: string,
  sessionDbId: number,
  context: Record<string, unknown> = {},
): string | null {
  const prompt = sessionStore.getUserPrompt(contentSessionId, promptNumber);
  if (!prompt || prompt.trim() === '') {
    logger.debug('HOOK', `Skipping ${lane} - user prompt was entirely private`, {
      sessionId: sessionDbId,
      promptNumber,
      ...context,
    });
    return null;
  }

  return prompt;
}

export class SessionRoutes extends RouteBase implements RouteHandler {
  private readonly completionHandler: SessionCompletionHandler;

  constructor(
    private readonly sessionManager: SessionManager,
    private readonly dbManager: DatabaseManager,
    private readonly sdkAgent: SDKAgent,
    private readonly geminiAgent: GeminiAgent,
    private readonly openRouterAgent: OpenRouterAgent,
    private readonly eventBroadcaster: SessionEventBroadcaster,
    private readonly workerService: WorkerService,
  ) {
    super();
    this.completionHandler = new SessionCompletionHandler(sessionManager, eventBroadcaster);
  }

  setupRoutes(app: Application): void {
    app.post('/sessions/:sessionDbId/init', this.handleSessionInit);
    app.post('/sessions/:sessionDbId/observations', this.handleObservations);
    app.post('/sessions/:sessionDbId/summarize', this.handleSummarize);
    app.get('/sessions/:sessionDbId/status', this.handleSessionStatus);
    app.delete('/sessions/:sessionDbId', this.handleSessionDelete);
    app.post('/sessions/:sessionDbId/complete', this.handleSessionComplete);
    app.post('/api/sessions/init', this.handleSessionInitByClaudeId);
    app.post('/api/sessions/observations', this.handleObservationsByClaudeId);
    app.post('/api/sessions/summarize', this.handleSummarizeByClaudeId);
  }

  private getSelectedProvider(): 'claude' | 'gemini' | 'openrouter' {
    if (isOpenRouterSelected() && isOpenRouterAvailable()) {
      return 'openrouter';
    }
    if (isGeminiSelected() && isGeminiAvailable()) {
      return 'gemini';
    }
    return 'claude';
  }

  private startGeneratorWithProvider(
    session: ReturnType<SessionManager['getSession']>,
    provider: 'claude' | 'gemini' | 'openrouter',
    source: string,
  ): void {
    if (!session) {
      return;
    }

    const agent = provider === 'openrouter'
      ? this.openRouterAgent
      : provider === 'gemini'
        ? this.geminiAgent
        : this.sdkAgent;
    const providerName = provider === 'openrouter'
      ? 'OpenRouter'
      : provider === 'gemini'
        ? 'Gemini'
        : 'Claude SDK';

    logger.info('SESSION', `Generator auto-starting (${source}) using ${providerName}`, {
      sessionId: session.sessionDbId,
      queueDepth: session.pendingMessages.length,
      historyLength: session.conversationHistory.length,
    });

    session.currentProvider = provider;
    session.generatorPromise = agent.startSession(session, this.workerService)
      .catch(error => {
        if (session.abortController.signal.aborted) {
          return;
        }

        logger.error('SESSION', 'Generator failed', {
          sessionId: session.sessionDbId,
          provider,
          error: (error as Error).message,
        }, error as Error);

        try {
          const failedCount = this.sessionManager.getPendingMessageStore().markSessionMessagesFailed(session.sessionDbId);
          if (failedCount > 0) {
            logger.error('SESSION', 'Marked messages as failed after generator error', {
              sessionId: session.sessionDbId,
              failedCount,
            });
          }
        } catch (markError) {
          logger.error('SESSION', 'Failed to mark messages as failed', {
            sessionId: session.sessionDbId,
          }, markError as Error);
        }
      })
      .finally(() => {
        const sessionDbId = session.sessionDbId;
        const aborted = session.abortController.signal.aborted;

        if (aborted) {
          logger.info('SESSION', 'Generator aborted', { sessionId: sessionDbId });
        } else {
          logger.error('SESSION', 'Generator exited unexpectedly', { sessionId: sessionDbId });
        }

        session.generatorPromise = null;
        session.currentProvider = null;
        this.workerService.broadcastProcessingStatus();

        if (aborted) {
          return;
        }

        try {
          const pendingCount = this.sessionManager.getPendingMessageStore().getPendingCount(sessionDbId);
          if (pendingCount > 0) {
            logger.info('SESSION', 'Restarting generator after crash/exit with pending work', {
              sessionId: sessionDbId,
              pendingCount,
            });

            const previousAbortController = session.abortController;
            session.abortController = new AbortController();
            previousAbortController.abort();

            setTimeout(() => {
              const activeSession = this.sessionManager.getSession(sessionDbId);
              if (activeSession && !activeSession.generatorPromise) {
                this.startGeneratorWithProvider(activeSession, this.getSelectedProvider(), 'crash-recovery');
              }
            }, 1000);
          } else {
            session.abortController.abort();
            logger.debug('SESSION', 'Aborted controller after natural completion', { sessionId: sessionDbId });
          }
        } catch (recoveryError) {
          logger.debug('SESSION', 'Error during recovery check, aborting to prevent leaks', {
            sessionId: sessionDbId,
            error: recoveryError instanceof Error ? recoveryError.message : String(recoveryError),
          });
          session.abortController.abort();
        }
      });
  }

  private ensureGeneratorRunning(sessionDbId: number, source: string): void {
    const session = this.sessionManager.getSession(sessionDbId);
    if (!session) {
      return;
    }

    const selectedProvider = this.getSelectedProvider();
    if (!session.generatorPromise) {
      this.startGeneratorWithProvider(session, selectedProvider, source);
      return;
    }

    if (session.currentProvider && session.currentProvider !== selectedProvider) {
      logger.info('SESSION', 'Provider changed, will switch after current generator finishes', {
        sessionId: sessionDbId,
        currentProvider: session.currentProvider,
        selectedProvider,
        historyLength: session.conversationHistory.length,
      });
    }
  }

  private readonly handleSessionInit = this.wrapHandler((req, res) => {
    const sessionDbId = this.parseIntParam(req, res, 'sessionDbId');
    if (sessionDbId === null) {
      return;
    }

    const { userPrompt, promptNumber } = req.body as { userPrompt?: string; promptNumber?: number };

    logger.info('HTTP', 'SessionRoutes: handleSessionInit called', {
      sessionDbId,
      promptNumber,
      has_userPrompt: !!userPrompt,
    });

    if (!this.dbManager.isInitialized()) {
      res.status(503).json({ error: 'Database not initialized. Please wait for initialization to complete.' });
      return;
    }

    const session = this.sessionManager.initializeSession(sessionDbId, userPrompt, promptNumber);
    const latestPrompt = this.dbManager.getSessionStore().getLatestUserPrompt(session.contentSessionId);

    if (latestPrompt) {
      this.eventBroadcaster.broadcastNewPrompt(latestPrompt);

      const syncStart = Date.now();
      const promptText = latestPrompt.prompt_text;
      this.dbManager.getChromaSync()
        .syncUserPrompt(
          latestPrompt.id,
          latestPrompt.memory_session_id,
          latestPrompt.project,
          promptText,
          latestPrompt.prompt_number,
          latestPrompt.created_at_epoch,
        )
        .then(() => {
          const elapsedMs = Date.now() - syncStart;
          logger.debug('CHROMA', 'User prompt synced', {
            promptId: latestPrompt.id,
            duration: `${elapsedMs}ms`,
            prompt: promptText.length > 60 ? `${promptText.substring(0, 60)}...` : promptText,
          });
        })
        .catch(error => {
          logger.error('CHROMA', 'User prompt sync failed, continuing without vector search', {
            promptId: latestPrompt.id,
            prompt: promptText.length > 60 ? `${promptText.substring(0, 60)}...` : promptText,
          }, error as Error);
        });
    }

    this.startGeneratorWithProvider(session, this.getSelectedProvider(), 'init');
    this.eventBroadcaster.broadcastSessionStarted(sessionDbId, session.project);

    res.json({
      status: 'initialized',
      sessionDbId,
      port: getWorkerPort(),
    });
  });

  private readonly handleObservations = this.wrapHandler((req, res) => {
    const sessionDbId = this.parseIntParam(req, res, 'sessionDbId');
    if (sessionDbId === null) {
      return;
    }

    const { tool_name, tool_input, tool_response, prompt_number, cwd } = req.body as Record<string, any>;
    this.sessionManager.queueObservation(sessionDbId, {
      tool_name,
      tool_input,
      tool_response,
      prompt_number,
      cwd,
    });
    this.ensureGeneratorRunning(sessionDbId, 'observation');
    this.eventBroadcaster.broadcastObservationQueued(sessionDbId);
    res.json({ status: 'queued' });
  });

  private readonly handleSummarize = this.wrapHandler((req, res) => {
    const sessionDbId = this.parseIntParam(req, res, 'sessionDbId');
    if (sessionDbId === null) {
      return;
    }

    const { last_assistant_message } = req.body as { last_assistant_message?: string };
    this.sessionManager.queueSummarize(sessionDbId, last_assistant_message);
    this.ensureGeneratorRunning(sessionDbId, 'summarize');
    this.eventBroadcaster.broadcastSummarizeQueued();
    res.json({ status: 'queued' });
  });

  private readonly handleSessionStatus = this.wrapHandler((req, res) => {
    const sessionDbId = this.parseIntParam(req, res, 'sessionDbId');
    if (sessionDbId === null) {
      return;
    }

    const session = this.sessionManager.getSession(sessionDbId);
    if (!session) {
      res.json({ status: 'not_found' });
      return;
    }

    res.json({
      status: 'active',
      sessionDbId,
      project: session.project,
      queueLength: session.pendingMessages.length,
      uptime: Date.now() - session.startTime,
    });
  });

  private readonly handleSessionDelete = this.wrapHandler(async (req, res) => {
    const sessionDbId = this.parseIntParam(req, res, 'sessionDbId');
    if (sessionDbId === null) {
      return;
    }

    await this.completionHandler.completeByDbId(sessionDbId);
    res.json({ status: 'deleted' });
  });

  private readonly handleSessionComplete = this.wrapHandler(async (req, res) => {
    const sessionDbId = this.parseIntParam(req, res, 'sessionDbId');
    if (sessionDbId === null) {
      return;
    }

    await this.completionHandler.completeByDbId(sessionDbId);
    res.json({ success: true });
  });

  private readonly handleObservationsByClaudeId = this.wrapHandler((req, res) => {
    const { contentSessionId, tool_name, tool_input, tool_response, cwd } = req.body as Record<string, any>;

    if (!contentSessionId) {
      this.badRequest(res, 'Missing contentSessionId');
      return;
    }

    if (getSkipTools().has(tool_name)) {
      logger.debug('SESSION', 'Skipping observation for tool', { tool_name });
      res.json({ status: 'skipped', reason: 'tool_excluded' });
      return;
    }

    if (new Set(['Edit', 'Write', 'Read', 'NotebookEdit']).has(tool_name) && tool_input) {
      const filePath = tool_input.file_path || tool_input.notebook_path;
      if (filePath && String(filePath).includes('session-memory')) {
        logger.debug('SESSION', 'Skipping meta-observation for session-memory file', {
          tool_name,
          file_path: filePath,
        });
        res.json({ status: 'skipped', reason: 'session_memory_meta' });
        return;
      }
    }

    if (!this.dbManager.isInitialized()) {
      res.status(503).json({ error: 'Database not initialized. Please wait for initialization to complete.' });
      return;
    }

    const sessionStore = this.dbManager.getSessionStore();
    const sessionDbId = sessionStore.createSDKSession(contentSessionId, '', '');
    const promptNumber = sessionStore.getPromptNumberFromUserPrompts(contentSessionId);

    if (!ensureUserPromptIsPublic(sessionStore, contentSessionId, promptNumber, 'observation', sessionDbId, { tool_name })) {
      res.json({ status: 'skipped', reason: 'private' });
      return;
    }

    const safeToolInput = tool_input !== undefined ? sanitizeToolPayload(JSON.stringify(tool_input)) : '{}';
    const safeToolResponse = tool_response !== undefined ? sanitizeToolPayload(JSON.stringify(tool_response)) : '{}';

    this.sessionManager.queueObservation(sessionDbId, {
      tool_name,
      tool_input: safeToolInput,
      tool_response: safeToolResponse,
      prompt_number: promptNumber,
      cwd: cwd || (() => {
        logger.error('SESSION', 'Missing cwd when queueing observation in SessionRoutes', {
          sessionId: sessionDbId,
          tool_name,
        });
        return '';
      })(),
    });
    this.ensureGeneratorRunning(sessionDbId, 'observation');
    this.eventBroadcaster.broadcastObservationQueued(sessionDbId);
    res.json({ status: 'queued' });
  });

  private readonly handleSummarizeByClaudeId = this.wrapHandler((req, res) => {
    const { contentSessionId, last_assistant_message } = req.body as {
      contentSessionId?: string;
      last_assistant_message?: string;
    };

    if (!contentSessionId) {
      this.badRequest(res, 'Missing contentSessionId');
      return;
    }

    if (!this.dbManager.isInitialized()) {
      res.status(503).json({ error: 'Database not initialized. Please wait for initialization to complete.' });
      return;
    }

    const sessionStore = this.dbManager.getSessionStore();
    const sessionDbId = sessionStore.createSDKSession(contentSessionId, '', '');
    const promptNumber = sessionStore.getPromptNumberFromUserPrompts(contentSessionId);

    if (!ensureUserPromptIsPublic(sessionStore, contentSessionId, promptNumber, 'summarize', sessionDbId)) {
      res.json({ status: 'skipped', reason: 'private' });
      return;
    }

    this.sessionManager.queueSummarize(sessionDbId, last_assistant_message);
    this.ensureGeneratorRunning(sessionDbId, 'summarize');
    this.eventBroadcaster.broadcastSummarizeQueued();
    res.json({ status: 'queued' });
  });

  private readonly handleSessionInitByClaudeId = this.wrapHandler((req, res) => {
    const { contentSessionId, project, prompt } = req.body as {
      contentSessionId?: string;
      project?: string;
      prompt?: string;
    };

    logger.info('HTTP', 'SessionRoutes: handleSessionInitByClaudeId called', {
      contentSessionId,
      project,
      prompt_length: prompt?.length,
    });

    if (!this.validateRequired(req, res, ['contentSessionId', 'project', 'prompt'])) {
      return;
    }

    if (!this.dbManager.isInitialized()) {
      res.status(503).json({ error: 'Database not initialized. Please wait for initialization to complete.' });
      return;
    }

    const sessionStore = this.dbManager.getSessionStore();
    const sessionDbId = sessionStore.createSDKSession(contentSessionId!, project!, prompt!);
    const existingSession = sessionStore.getSessionById(sessionDbId);
    const isNewSession = !existingSession?.memory_session_id;

    logger.info('SESSION', `CREATED | contentSessionId=${contentSessionId} -> sessionDbId=${sessionDbId} | isNew=${isNewSession} | project=${project}`, {
      sessionId: sessionDbId,
    });

    const promptNumber = sessionStore.getPromptNumberFromUserPrompts(contentSessionId!) + 1;
    const memorySessionId = existingSession?.memory_session_id || null;

    if (promptNumber > 1) {
      logger.debug('HTTP', `[ALIGNMENT] DB Lookup Proof | contentSessionId=${contentSessionId} -> memorySessionId=${memorySessionId || '(not yet captured)'} | prompt#=${promptNumber}`);
    } else {
      logger.debug('HTTP', `[ALIGNMENT] New Session | contentSessionId=${contentSessionId} | prompt#=${promptNumber} | memorySessionId will be captured on first SDK response`);
    }

    const sanitizedPrompt = sanitizeUserPrompt(prompt!);
    if (!sanitizedPrompt || sanitizedPrompt.trim() === '') {
      logger.debug('HOOK', 'Session init - prompt entirely private', {
        sessionId: sessionDbId,
        promptNumber,
        originalLength: prompt!.length,
      });
      res.json({
        sessionDbId,
        promptNumber,
        skipped: true,
        reason: 'private',
      });
      return;
    }

    sessionStore.saveUserPrompt(contentSessionId!, promptNumber, sanitizedPrompt);
    logger.debug('SESSION', 'User prompt saved', { sessionId: sessionDbId, promptNumber });

    res.json({
      sessionDbId,
      promptNumber,
      skipped: false,
    });
  });
}
