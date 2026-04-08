import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { dirname, join } from 'path';
import { clearPortCache } from '../../../../common/engine-utils.js';
import { SettingsDefaultsManager } from '../../../../common/SettingsDefaultsManager.js';
import { getBranchInfo, pullUpdates, switchBranch } from '../../BranchManager.js';
import { logger } from '../../../../utils/logger.js';
import { type RouteHandler } from '../../../api/Server.js';
import { type Application } from 'express';
import { type SettingsManager } from '../../SettingsManager.js';
import { resolvePluginRoot } from '../paths.js';
import { RouteBase } from './RouteBase.js';

const USER_SETTINGS_PATH = join(homedir(), '.claude-recall', 'settings.json');

export class SettingsRoutes extends RouteBase implements RouteHandler {
  constructor(_settingsManager: SettingsManager) {
    super();
  }

  setupRoutes(app: Application): void {
    app.get('/api/settings', this.handleGetSettings);
    app.post('/api/settings', this.handleUpdateSettings);
    app.get('/api/mcp/status', this.handleGetMcpStatus);
    app.post('/api/mcp/toggle', this.handleToggleMcp);
    app.get('/api/branch/status', this.handleGetBranchStatus);
    app.post('/api/branch/switch', this.handleSwitchBranch);
    app.post('/api/branch/update', this.handleUpdateBranch);
  }

  private ensureSettingsFile(settingsPath: string): void {
    if (existsSync(settingsPath)) {
      return;
    }

    const settingsDir = dirname(settingsPath);
    if (!existsSync(settingsDir)) {
      mkdirSync(settingsDir, { recursive: true });
    }

    writeFileSync(settingsPath, JSON.stringify(SettingsDefaultsManager.getAllDefaults(), null, 2), 'utf-8');
    logger.info('SYSTEM', 'Created settings file with defaults', { settingsPath });
  }

  private validateSettings(body: Record<string, string>): { valid: true } | { valid: false; error: string } {
    if (body.CLAUDE_MEM_PROVIDER && !['claude', 'gemini', 'openrouter'].includes(body.CLAUDE_MEM_PROVIDER)) {
      return { valid: false, error: 'CLAUDE_MEM_PROVIDER must be "claude", "gemini", or "openrouter"' };
    }

    if (body.CLAUDE_MEM_GEMINI_MODEL && !['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-3-flash'].includes(body.CLAUDE_MEM_GEMINI_MODEL)) {
      return { valid: false, error: 'CLAUDE_MEM_GEMINI_MODEL must be one of: gemini-2.5-flash-lite, gemini-2.5-flash, gemini-3-flash' };
    }

    if (body.CLAUDE_MEM_CONTEXT_OBSERVATIONS) {
      const value = parseInt(body.CLAUDE_MEM_CONTEXT_OBSERVATIONS, 10);
      if (Number.isNaN(value) || value < 1 || value > 200) {
        return { valid: false, error: 'CLAUDE_MEM_CONTEXT_OBSERVATIONS must be between 1 and 200' };
      }
    }

    if (body.CLAUDE_MEM_WORKER_PORT) {
      const value = parseInt(body.CLAUDE_MEM_WORKER_PORT, 10);
      if (Number.isNaN(value) || value < 1024 || value > 65535) {
        return { valid: false, error: 'CLAUDE_MEM_WORKER_PORT must be between 1024 and 65535' };
      }
    }

    if (body.CLAUDE_MEM_WORKER_HOST) {
      const value = body.CLAUDE_MEM_WORKER_HOST;
      if (!/^(127\.0\.0\.1|0\.0\.0\.0|localhost|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.test(value)) {
        return { valid: false, error: 'CLAUDE_MEM_WORKER_HOST must be a valid IP address (e.g., 127.0.0.1, 0.0.0.0)' };
      }
    }

    if (body.CLAUDE_MEM_LOG_LEVEL && !['DEBUG', 'INFO', 'WARN', 'ERROR', 'SILENT'].includes(body.CLAUDE_MEM_LOG_LEVEL.toUpperCase())) {
      return { valid: false, error: 'CLAUDE_MEM_LOG_LEVEL must be one of: DEBUG, INFO, WARN, ERROR, SILENT' };
    }

    if (body.CLAUDE_MEM_PYTHON_VERSION && !/^3\.\d{1,2}$/.test(body.CLAUDE_MEM_PYTHON_VERSION)) {
      return { valid: false, error: 'CLAUDE_MEM_PYTHON_VERSION must be in format "3.X" or "3.XX" (e.g., "3.13")' };
    }

    for (const flag of [
      'CLAUDE_MEM_CONTEXT_SHOW_READ_TOKENS',
      'CLAUDE_MEM_CONTEXT_SHOW_WORK_TOKENS',
      'CLAUDE_MEM_CONTEXT_SHOW_SAVINGS_AMOUNT',
      'CLAUDE_MEM_CONTEXT_SHOW_SAVINGS_PERCENT',
      'CLAUDE_MEM_CONTEXT_SHOW_LAST_SUMMARY',
      'CLAUDE_MEM_CONTEXT_SHOW_LAST_MESSAGE',
    ]) {
      if (body[flag] && !['true', 'false'].includes(body[flag])) {
        return { valid: false, error: `${flag} must be "true" or "false"` };
      }
    }

    if (body.CLAUDE_MEM_CONTEXT_FULL_COUNT) {
      const value = parseInt(body.CLAUDE_MEM_CONTEXT_FULL_COUNT, 10);
      if (Number.isNaN(value) || value < 0 || value > 20) {
        return { valid: false, error: 'CLAUDE_MEM_CONTEXT_FULL_COUNT must be between 0 and 20' };
      }
    }

    if (body.CLAUDE_MEM_CONTEXT_SESSION_COUNT) {
      const value = parseInt(body.CLAUDE_MEM_CONTEXT_SESSION_COUNT, 10);
      if (Number.isNaN(value) || value < 1 || value > 50) {
        return { valid: false, error: 'CLAUDE_MEM_CONTEXT_SESSION_COUNT must be between 1 and 50' };
      }
    }

    if (body.CLAUDE_MEM_CONTEXT_FULL_FIELD && !['narrative', 'facts'].includes(body.CLAUDE_MEM_CONTEXT_FULL_FIELD)) {
      return { valid: false, error: 'CLAUDE_MEM_CONTEXT_FULL_FIELD must be "narrative" or "facts"' };
    }

    if (body.CLAUDE_MEM_OPENROUTER_MAX_CONTEXT_MESSAGES) {
      const value = parseInt(body.CLAUDE_MEM_OPENROUTER_MAX_CONTEXT_MESSAGES, 10);
      if (Number.isNaN(value) || value < 1 || value > 100) {
        return { valid: false, error: 'CLAUDE_MEM_OPENROUTER_MAX_CONTEXT_MESSAGES must be between 1 and 100' };
      }
    }

    if (body.CLAUDE_MEM_OPENROUTER_MAX_TOKENS) {
      const value = parseInt(body.CLAUDE_MEM_OPENROUTER_MAX_TOKENS, 10);
      if (Number.isNaN(value) || value < 1000 || value > 1_000_000) {
        return { valid: false, error: 'CLAUDE_MEM_OPENROUTER_MAX_TOKENS must be between 1000 and 1000000' };
      }
    }

    if (body.CLAUDE_MEM_OPENROUTER_SITE_URL) {
      try {
        new URL(body.CLAUDE_MEM_OPENROUTER_SITE_URL);
      } catch (error) {
        logger.debug('SYSTEM', 'Invalid URL format', {
          url: body.CLAUDE_MEM_OPENROUTER_SITE_URL,
          error: error instanceof Error ? error.message : String(error),
        });
        return { valid: false, error: 'CLAUDE_MEM_OPENROUTER_SITE_URL must be a valid URL' };
      }
    }

    return { valid: true };
  }

  private isMcpEnabled(): boolean {
    return existsSync(join(resolvePluginRoot(), 'plugin', '.mcp.json'));
  }

  private toggleMcp(enabled: boolean): void {
    const root = resolvePluginRoot();
    const enabledPath = join(root, 'plugin', '.mcp.json');
    const disabledPath = join(root, 'plugin', '.mcp.json.disabled');

    if (enabled && existsSync(disabledPath)) {
      renameSync(disabledPath, enabledPath);
      logger.info('SYSTEM', 'MCP search server enabled');
      return;
    }

    if (!enabled && existsSync(enabledPath)) {
      renameSync(enabledPath, disabledPath);
      logger.info('SYSTEM', 'MCP search server disabled');
      return;
    }

    logger.debug('SYSTEM', 'MCP toggle no-op (already in desired state)', { enabled });
  }

  private readonly handleGetSettings = this.wrapHandler((_req, res) => {
    this.ensureSettingsFile(USER_SETTINGS_PATH);
    res.json(SettingsDefaultsManager.loadFromFile(USER_SETTINGS_PATH));
  });

  private readonly handleUpdateSettings = this.wrapHandler((req, res) => {
    const validation = this.validateSettings(req.body);
    if (!validation.valid) {
      res.status(400).json({ success: false, error: validation.error });
      return;
    }

    this.ensureSettingsFile(USER_SETTINGS_PATH);

    let settings: Record<string, unknown> = {};
    if (existsSync(USER_SETTINGS_PATH)) {
      const contents = readFileSync(USER_SETTINGS_PATH, 'utf-8');
      try {
        settings = JSON.parse(contents);
      } catch (error) {
        logger.error('SYSTEM', 'Failed to parse settings file', { settingsPath: USER_SETTINGS_PATH }, error as Error);
        res.status(500).json({
          success: false,
          error: 'Settings file is corrupted. Delete ~/.claude-recall/settings.json to reset.',
        });
        return;
      }
    }

    const allowedKeys = [
      'CLAUDE_MEM_MODEL',
      'CLAUDE_MEM_CONTEXT_OBSERVATIONS',
      'CLAUDE_MEM_WORKER_PORT',
      'CLAUDE_MEM_WORKER_HOST',
      'CLAUDE_MEM_PROVIDER',
      'CLAUDE_MEM_GEMINI_API_KEY',
      'CLAUDE_MEM_GEMINI_MODEL',
      'CLAUDE_MEM_GEMINI_RATE_LIMITING_ENABLED',
      'CLAUDE_MEM_OPENROUTER_API_KEY',
      'CLAUDE_MEM_OPENROUTER_MODEL',
      'CLAUDE_MEM_OPENROUTER_SITE_URL',
      'CLAUDE_MEM_OPENROUTER_APP_NAME',
      'CLAUDE_MEM_OPENROUTER_MAX_CONTEXT_MESSAGES',
      'CLAUDE_MEM_OPENROUTER_MAX_TOKENS',
      'CLAUDE_MEM_DATA_DIR',
      'CLAUDE_MEM_LOG_LEVEL',
      'CLAUDE_MEM_PYTHON_VERSION',
      'CLAUDE_CODE_PATH',
      'CLAUDE_MEM_CONTEXT_SHOW_READ_TOKENS',
      'CLAUDE_MEM_CONTEXT_SHOW_WORK_TOKENS',
      'CLAUDE_MEM_CONTEXT_SHOW_SAVINGS_AMOUNT',
      'CLAUDE_MEM_CONTEXT_SHOW_SAVINGS_PERCENT',
      'CLAUDE_MEM_CONTEXT_OBSERVATION_TYPES',
      'CLAUDE_MEM_CONTEXT_OBSERVATION_CONCEPTS',
      'CLAUDE_MEM_CONTEXT_FULL_COUNT',
      'CLAUDE_MEM_CONTEXT_FULL_FIELD',
      'CLAUDE_MEM_CONTEXT_SESSION_COUNT',
      'CLAUDE_MEM_CONTEXT_SHOW_LAST_SUMMARY',
      'CLAUDE_MEM_CONTEXT_SHOW_LAST_MESSAGE',
    ];

    for (const key of allowedKeys) {
      if (req.body[key] !== undefined) {
        settings[key] = req.body[key];
      }
    }

    writeFileSync(USER_SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf-8');
    clearPortCache();
    logger.info('SYSTEM', 'Settings updated');
    res.json({ success: true, message: 'Settings updated successfully' });
  });

  private readonly handleGetMcpStatus = this.wrapHandler((_req, res) => {
    res.json({ enabled: this.isMcpEnabled() });
  });

  private readonly handleToggleMcp = this.wrapHandler((req, res) => {
    const { enabled } = req.body as { enabled?: boolean };
    if (typeof enabled !== 'boolean') {
      this.badRequest(res, 'enabled must be a boolean');
      return;
    }

    this.toggleMcp(enabled);
    res.json({ success: true, enabled: this.isMcpEnabled() });
  });

  private readonly handleGetBranchStatus = this.wrapHandler((_req, res) => {
    res.json(getBranchInfo());
  });

  private readonly handleSwitchBranch = this.wrapHandler(async (req, res) => {
    const { branch } = req.body as { branch?: string };
    if (!branch) {
      res.status(400).json({ success: false, error: 'Missing branch parameter' });
      return;
    }

    const allowedBranches = ['main', 'beta/7.0', 'feature/bun-executable'];
    if (!allowedBranches.includes(branch)) {
      res.status(400).json({ success: false, error: `Invalid branch. Allowed: ${allowedBranches.join(', ')}` });
      return;
    }

    logger.info('SYSTEM', 'Branch switch requested', { branch });
    const result = await switchBranch(branch);
    if (result.success) {
      setTimeout(() => {
        logger.info('SYSTEM', 'Restarting worker after branch switch');
        process.exit(0);
      }, 1000);
    }

    res.json(result);
  });

  private readonly handleUpdateBranch = this.wrapHandler(async (_req, res) => {
    logger.info('SYSTEM', 'Branch update requested');
    const result = await pullUpdates();
    if (result.success) {
      setTimeout(() => {
        logger.info('SYSTEM', 'Restarting worker after branch update');
        process.exit(0);
      }, 1000);
    }

    res.json(result);
  });
}
