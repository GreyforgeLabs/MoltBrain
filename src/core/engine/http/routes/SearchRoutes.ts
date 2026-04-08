import { type Application, type Request } from 'express';
import { generateContext } from '../../../builder-generator.js';
import { type RouteHandler } from '../../../api/Server.js';
import { type SearchManager } from '../../SearchManager.js';
import { RouteBase } from './RouteBase.js';

function getQueryValue(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0];
  }
  return undefined;
}

export class SearchRoutes extends RouteBase implements RouteHandler {
  constructor(private readonly searchManager: SearchManager) {
    super();
  }

  setupRoutes(app: Application): void {
    app.get('/api/search', this.handleUnifiedSearch);
    app.get('/api/timeline', this.handleUnifiedTimeline);
    app.get('/api/decisions', this.handleDecisions);
    app.get('/api/changes', this.handleChanges);
    app.get('/api/how-it-works', this.handleHowItWorks);
    app.get('/api/search/observations', this.handleSearchObservations);
    app.get('/api/search/sessions', this.handleSearchSessions);
    app.get('/api/search/prompts', this.handleSearchPrompts);
    app.get('/api/search/by-concept', this.handleSearchByConcept);
    app.get('/api/search/by-file', this.handleSearchByFile);
    app.get('/api/search/by-type', this.handleSearchByType);
    app.get('/api/context/recent', this.handleGetRecentContext);
    app.get('/api/context/timeline', this.handleGetContextTimeline);
    app.get('/api/context/preview', this.handleContextPreview);
    app.get('/api/context/inject', this.handleContextInject);
    app.get('/api/timeline/by-query', this.handleGetTimelineByQuery);
    app.get('/api/search/help', this.handleSearchHelp);
  }

  private readonly handleUnifiedSearch = this.wrapHandler(async (req, res) => {
    res.json(await this.searchManager.search(req.query as any));
  });

  private readonly handleUnifiedTimeline = this.wrapHandler(async (req, res) => {
    res.json(await this.searchManager.timeline(req.query as any));
  });

  private readonly handleDecisions = this.wrapHandler(async (req, res) => {
    res.json(await this.searchManager.decisions(req.query as any));
  });

  private readonly handleChanges = this.wrapHandler(async (req, res) => {
    res.json(await this.searchManager.changes(req.query as any));
  });

  private readonly handleHowItWorks = this.wrapHandler(async (req, res) => {
    res.json(await this.searchManager.howItWorks(req.query as any));
  });

  private readonly handleSearchObservations = this.wrapHandler(async (req, res) => {
    res.json(await this.searchManager.searchObservations(req.query as any));
  });

  private readonly handleSearchSessions = this.wrapHandler(async (req, res) => {
    res.json(await this.searchManager.searchSessions(req.query as any));
  });

  private readonly handleSearchPrompts = this.wrapHandler(async (req, res) => {
    res.json(await this.searchManager.searchUserPrompts(req.query as any));
  });

  private readonly handleSearchByConcept = this.wrapHandler(async (req, res) => {
    res.json(await this.searchManager.findByConcept(req.query as any));
  });

  private readonly handleSearchByFile = this.wrapHandler(async (req, res) => {
    res.json(await this.searchManager.findByFile(req.query as any));
  });

  private readonly handleSearchByType = this.wrapHandler(async (req, res) => {
    res.json(await this.searchManager.findByType(req.query as any));
  });

  private readonly handleGetRecentContext = this.wrapHandler(async (req, res) => {
    res.json(await this.searchManager.getRecentContext(req.query as any));
  });

  private readonly handleGetContextTimeline = this.wrapHandler(async (req, res) => {
    res.json(await this.searchManager.getContextTimeline(req.query as any));
  });

  private readonly handleContextPreview = this.wrapHandler(async (req, res) => {
    const project = getQueryValue(req.query.project);
    if (!project) {
      this.badRequest(res, 'Project parameter is required');
      return;
    }

    const content = await generateContext({
      session_id: `preview-${Date.now()}`,
      cwd: `/preview/${project}`,
    }, true);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(content);
  });

  private readonly handleContextInject = this.wrapHandler(async (req, res) => {
    const projectValue = getQueryValue(req.query.projects) || getQueryValue(req.query.project);
    const colors = getQueryValue(req.query.colors) === 'true';

    if (!projectValue) {
      this.badRequest(res, 'Project(s) parameter is required');
      return;
    }

    const projects = projectValue.split(',').map(value => value.trim()).filter(Boolean);
    if (projects.length === 0) {
      this.badRequest(res, 'At least one project is required');
      return;
    }

    const content = await generateContext({
      session_id: `context-inject-${Date.now()}`,
      cwd: `/context/${projects[projects.length - 1]}`,
      projects,
    }, colors);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(content);
  });

  private readonly handleGetTimelineByQuery = this.wrapHandler(async (req, res) => {
    res.json(await this.searchManager.getTimelineByQuery(req.query as any));
  });

  private readonly handleSearchHelp = this.wrapHandler((_req, res) => {
    res.json({
      title: 'Claude-Mem Search API',
      description: 'HTTP API for searching persistent memory',
      endpoints: [
        {
          path: '/api/search/observations',
          method: 'GET',
          description: 'Search observations using full-text search',
          parameters: {
            query: 'Search query (required)',
            limit: 'Number of results (default: 20)',
            project: 'Filter by project name (optional)',
          },
        },
        {
          path: '/api/search/sessions',
          method: 'GET',
          description: 'Search session summaries using full-text search',
          parameters: {
            query: 'Search query (required)',
            limit: 'Number of results (default: 20)',
          },
        },
        {
          path: '/api/search/prompts',
          method: 'GET',
          description: 'Search user prompts using full-text search',
          parameters: {
            query: 'Search query (required)',
            limit: 'Number of results (default: 20)',
            project: 'Filter by project name (optional)',
          },
        },
        {
          path: '/api/search/by-concept',
          method: 'GET',
          description: 'Find observations by concept tag',
          parameters: {
            concept: 'Concept tag (required): discovery, decision, bugfix, feature, refactor',
            limit: 'Number of results (default: 10)',
            project: 'Filter by project name (optional)',
          },
        },
        {
          path: '/api/search/by-file',
          method: 'GET',
          description: 'Find observations and sessions by file path',
          parameters: {
            filePath: 'File path or partial path (required)',
            limit: 'Number of results per type (default: 10)',
            project: 'Filter by project name (optional)',
          },
        },
        {
          path: '/api/search/by-type',
          method: 'GET',
          description: 'Find observations by type',
          parameters: {
            type: 'Observation type (required): discovery, decision, bugfix, feature, refactor',
            limit: 'Number of results (default: 10)',
            project: 'Filter by project name (optional)',
          },
        },
        {
          path: '/api/context/recent',
          method: 'GET',
          description: 'Get recent session context including summaries and observations',
          parameters: {
            project: 'Project name (default: current directory)',
            limit: 'Number of recent sessions (default: 3)',
          },
        },
        {
          path: '/api/context/timeline',
          method: 'GET',
          description: 'Get unified timeline around a specific point in time',
          parameters: {
            anchor: 'Anchor point: observation ID, session ID (e.g., "S123"), or ISO timestamp (required)',
            depth_before: 'Number of records before anchor (default: 10)',
            depth_after: 'Number of records after anchor (default: 10)',
            project: 'Filter by project name (optional)',
          },
        },
        {
          path: '/api/timeline/by-query',
          method: 'GET',
          description: 'Search for best match, then get timeline around it',
          parameters: {
            query: 'Search query (required)',
            mode: 'Search mode: "auto", "observations", or "sessions" (default: "auto")',
            depth_before: 'Number of records before match (default: 10)',
            depth_after: 'Number of records after match (default: 10)',
            project: 'Filter by project name (optional)',
          },
        },
        {
          path: '/api/search/help',
          method: 'GET',
          description: 'Get this help documentation',
        },
      ],
      examples: [
        'curl "http://localhost:37777/api/search/observations?query=authentication&limit=5"',
        'curl "http://localhost:37777/api/search/by-type?type=bugfix&limit=10"',
        'curl "http://localhost:37777/api/context/recent?project=claude-recall&limit=3"',
        'curl "http://localhost:37777/api/context/timeline?anchor=123&depth_before=5&depth_after=5"',
      ],
    });
  });
}
