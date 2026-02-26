<p align="center">
  
<img width="1344" height="768" alt="Untitled design (32)" src="https://github.com/user-attachments/assets/03483342-0950-4d80-8bd2-423cd644b6ba" />

</p>

<p align="center">

</p>

<p align="center">
  <strong>Long-term memory layer for OpenClaw, MoltBook & Claude Code that learns and recalls your project context automatically. $BRAIN CA 0x35e7942E91876Eb0c24A891128E559a744fe8B07 </strong>
</p>

<p align="center">
  <a href="#-quick-install">Install</a> •
  <a href="#-features">Features</a> •
  <a href="#-how-it-works">How It Works</a> •
  <a href="#-storage-dapp">Storage</a> •
  <a href="#-virtuals-protocol-integration">Virtuals</a> •
  <a href="#-openclaw-integration">OpenClaw</a> •
  <a href="#%EF%B8%8F-configuration">Config</a> •
  <a href="#-api">API</a>
</p>

---

<br>

## ⚡ Quick Install

<p align="center">

```
╔══════════════════════════════════════════════════════════════════════╗
║                                                                      ║
║   Step 1    /plugin marketplace add nhevers/moltbrain                ║
║   Step 2    /plugin install moltbrain                                ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
```

</p>

<p align="center"><em>That's it. MoltBrain starts working automatically.</em></p>

---

<br>

## 🧠 What It Does

```
╭──────────────────────────────────────────────────────────────────────────────╮
│                                                                              │
│     ┌─────────────────┐                      ┌─────────────────┐             │
│     │   SESSION #1    │                      │   SESSION #47   │             │
│     │─────────────────│                      │─────────────────│             │
│     │                 │                      │                 │             │
│     │  "Set up auth   │                      │  "Add password  │             │
│     │   with OAuth"   │                      │   reset flow"   │             │
│     │                 │                      │                 │             │
│     └────────┬────────┘                      └────────┬────────┘             │
│              │                                        │                      │
│              │  Claude discovers:                     │  Claude remembers:   │
│              │  • OAuth2 + PKCE flow                  │  • Your auth setup   │
│              │  • JWT with 1hr expiry                 │  • Token structure   │
│              │  • bcrypt cost factor 12               │  • Security choices  │
│              │                                        │                      │
│              ▼                                        ▲                      │
│     ┌────────────────┐                      ┌────────────────┐               │
│     │    CAPTURE     │ ──────────────────►  │     INJECT     │               │
│     │   & LEARN      │      MEMORY          │    & RECALL    │               │
│     └────────────────┘                      └────────────────┘               │
│                                                                              │
╰──────────────────────────────────────────────────────────────────────────────╯
```

<br>

---

## ✨ Features

```
+-------------------------+-------------------------+-------------------------+
|                         |                         |                         |
|   OBSERVATIONS          |   SMART SEARCH          |   WEB VIEWER            |
|   ----------------      |   ----------------      |   ----------------      |
|   Auto-captures         |   Semantic search       |   Browse history        |
|   discoveries,          |   via MCP tools         |   at localhost          |
|   decisions & code      |   finds context         |   :37777                |
|                         |                         |                         |
+-------------------------+-------------------------+-------------------------+
|                         |                         |                         |
|   ANALYTICS             |   TAGS & FILTERS        |   FAVORITES             |
|   ----------------      |   ----------------      |   ----------------      |
|   Track tokens,         |   Organize with         |   Bookmark your         |
|   sessions, and         |   custom tags &         |   most important        |
|   concept trends        |   smart filters         |   observations          |
|                         |                         |                         |
+-------------------------+-------------------------+-------------------------+
|                         |                         |                         |
|   EXPORT                |   THEMES                |   SHORTCUTS             |
|   ----------------      |   ----------------      |   ----------------      |
|   JSON, CSV, or         |   Dark & light          |   Full keyboard         |
|   Markdown with         |   mode with             |   navigation in         |
|   custom templates      |   custom themes         |   the web viewer        |
|                         |                         |                         |
+-------------------------+-------------------------+-------------------------+
```

<br>

---

## 🔧 How It Works

```
                         ╔═══════════════════════════════════╗
                         ║      CLAUDE CODE SESSION          ║
                         ╚═══════════════╤═══════════════════╝
                                         │
                    ┌────────────────────┼────────────────────┐
                    │                    │                    │
                    ▼                    ▼                    ▼
           ╔════════════════╗   ╔════════════════╗   ╔════════════════╗
           ║  SessionStart  ║   ║  PostToolUse   ║   ║     Stop       ║
           ║────────────────║   ║────────────────║   ║────────────────║
           ║ Inject context ║   ║ Capture output ║   ║ Generate       ║
           ║ from memory    ║   ║ extract facts  ║   ║ summary        ║
           ╚═══════╤════════╝   ╚═══════╤════════╝   ╚═══════╤════════╝
                   │                    │                    │
                   └────────────────────┼────────────────────┘
                                        │
                         ╔══════════════╧══════════════╗
                         ║      WORKER SERVICE         ║
                         ║    http://localhost:37777   ║
                         ╚══════════════╤══════════════╝
                                        │
              ┌─────────────────────────┼─────────────────────────┐
              │                         │                         │
              ▼                         ▼                         ▼
     ╔════════════════╗       ╔════════════════╗       ╔════════════════╗
     ║    SQLite      ║       ║   ChromaDB     ║       ║  Web Viewer    ║
     ║   Database     ║       ║ Vector Search  ║       ║     UI         ║
     ║────────────────║       ║────────────────║       ║────────────────║
     ║ Observations   ║       ║ Semantic       ║       ║ Timeline       ║
     ║ Summaries      ║       ║ similarity     ║       ║ Search         ║
     ║ Sessions       ║       ║ matching       ║       ║ Analytics      ║
     ╚════════════════╝       ╚════════════════╝       ╚════════════════╝
```

<br>

---

## ⚙️ Configuration

Settings stored in `~/.moltbrain/settings.json`:

```
┌──────────────────────────────────────┬─────────┬────────────────────────────┐
│             SETTING                  │ DEFAULT │        DESCRIPTION         │
├──────────────────────────────────────┼─────────┼────────────────────────────┤
│ MOLTBRAIN_WORKER_PORT                │  37777  │ Worker service port        │
├──────────────────────────────────────┼─────────┼────────────────────────────┤
│ MOLTBRAIN_CONTEXT_OBSERVATIONS       │   50    │ Max observations to inject │
├──────────────────────────────────────┼─────────┼────────────────────────────┤
│ MOLTBRAIN_PROVIDER                   │ claude  │ AI provider for summaries  │
├──────────────────────────────────────┼─────────┼────────────────────────────┤
│ MOLTBRAIN_PRUNE_DAYS                 │    0    │ Auto-prune (0 = disabled)  │
├──────────────────────────────────────┼─────────┼────────────────────────────┤
│ MOLTBRAIN_THEME                      │ system  │ UI theme (dark/light/sys)  │
├──────────────────────────────────────┼─────────┼────────────────────────────┤
│ MOLTBRAIN_LOG_LEVEL                  │  info   │ Logging verbosity level    │
└──────────────────────────────────────┴─────────┴────────────────────────────┘
```

<br>

---

## 💻 CLI Commands

```bash
moltbrain stats          # Show memory statistics
moltbrain export         # Export to markdown  
moltbrain tag <id> <t>   # Tag an observation
moltbrain prune          # Manual cleanup
moltbrain search <q>     # Search observations
```

<br>

---

## 📁 Project Structure

```
moltbrain/
│
├── 📊 benchmarks/         Performance tests
├── 🎨 contrib/            Community modes & themes
├── 📚 docs/               Documentation
├── 📖 examples/           Usage examples & guides
│
├── 🔌 extension/
│   ├── profiles/          Observation modes
│   ├── runtime/           Worker scripts
│   ├── themes/            UI themes (dark/light)
│   ├── snippets/          Code snippets
│   └── templates/         Summary templates
│
├── 🌍 locales/            i18n (en, es, fr)
├── 🗄️ migrations/         Database migrations
├── 📋 schemas/            JSON validation schemas
├── 🛠️ scripts/            Build & utility scripts
│
├── 💻 src/
│   ├── analytics/         Token & session tracking
│   ├── cache/             Query & context caching
│   ├── core/              Core engine
│   ├── export/            JSON/CSV/MD exporters
│   ├── favorites/         Bookmark system
│   ├── filters/           Date/type/project filters
│   ├── formatters/        Output formatters
│   ├── mcp/               MCP server for OpenClaw & MoltBook
│   ├── shortcuts/         Keyboard shortcuts
│   ├── themes/            Theme system
│   └── validators/        Input validation
│
├── 🦞 integrations/
│   └── clawd/             Clawd extension & skill
│
├── 📝 templates/          Export templates
├── 🧪 tests/              Test suites
└── 🔧 tools/              CLI utilities
```

<br>

---

## 🔌 API

The worker exposes a REST API at `http://localhost:37777`:

```bash
# Health check
curl http://localhost:37777/health

# Search observations
curl "http://localhost:37777/api/search?q=authentication"

# Get timeline
curl "http://localhost:37777/api/timeline?project=my-app&days=7"

# Export data
curl "http://localhost:37777/api/export?format=json" > backup.json

# Get statistics
curl "http://localhost:37777/api/stats"
```

<br>

---

## 🗄️ Storage Dapp

Persistent, Postgres-backed storage for agents and apps. Live at **[app.moltbrain.dev/storage](https://app.moltbrain.dev/storage)**.

```
+-----------------------------------------------------------------------------+
|                                                                             |
|   BLOB STORAGE      Content-addressed JSON blobs via SHA-256                |
|   ----------         Store and retrieve data by hash. $0.01 per request.   |
|                                                                             |
|   MEMORY SLOTS      Named key-value slots for agent state                  |
|   ----------         Allocate, write, read. Persistent across sessions.    |
|                                                                             |
|   AGENT VAULT       Per-wallet scoping with label badges                   |
|   ----------         Connect the same wallet your agents use.              |
|                      Browse, view, and delete what they stored.            |
|                                                                             |
+-----------------------------------------------------------------------------+
```

All endpoints are paid via [x402](https://www.x402.org) micropayments ($0.01 USDC on Base). Data is scoped per wallet, backed by Postgres, and survives redeploys.

Agents can tag stored data with a `label` (e.g. `"openclaw_session"`, `"virtuals_agent"`) so the vault shows what stored each item.

```bash
# Store a blob
curl -X POST https://app.moltbrain.dev/api/x402/store \
  -H "X-PAYMENT: <x402_header>" \
  -d '{"data": {"key": "value"}, "label": "my_agent"}'

# List your blobs
curl https://app.moltbrain.dev/api/x402/list/blobs \
  -H "X-PAYMENT: <x402_header>"

# Full catalog
curl https://app.moltbrain.dev/api/x402/catalog
```

<br>

---

## 🎮 Virtuals Protocol Integration

GAME SDK plugin that gives any [Virtuals Protocol](https://virtuals.io) AI agent persistent memory and storage via MoltBrain.

```bash
npm install @moltbrain/game-plugin
```

```typescript
import { GameAgent } from "@virtuals-protocol/game";
import { MoltBrainPlugin } from "@moltbrain/game-plugin";

const moltbrain = new MoltBrainPlugin({
  privateKey: process.env.AGENT_PRIVATE_KEY!, // wallet with USDC on Base
});

const agent = new GameAgent(process.env.GAME_API_KEY!, {
  name: "My Agent",
  goal: "Remember everything across sessions",
  description: "An agent with persistent memory via MoltBrain",
  workers: [moltbrain.getWorker()],
});

await agent.init();
await agent.step({ verbose: true });
```

9 functions available: `moltbrain_chat`, `moltbrain_search`, `moltbrain_store`, `moltbrain_retrieve`, `moltbrain_allocate_slot`, `moltbrain_write_slot`, `moltbrain_read_slot`, `moltbrain_stats`, `moltbrain_capacity`.

Everything the agent stores shows up in the vault dapp at [app.moltbrain.dev/storage](https://app.moltbrain.dev/storage). Connect the same wallet to browse it.

See the full plugin repo: **[github.com/nhevers/Moltbrain-virtuals](https://github.com/nhevers/Moltbrain-virtuals)**

<br>

---

## 🦞 OpenClaw Integration

Works with [OpenClaw](https://github.com/openclaw/openclaw) (116k+ stars) - the popular personal AI assistant!

```
+-----------------------------------------------------------------------------+
|                                                                             |
|   EXTENSION        Add to OpenClaw's extensions/ folder                     |
|   ----------       Full lifecycle hooks integration                         |
|                                                                             |
|   SKILL            Install as an OpenClaw skill                              |
|   ----------       recall_context, search_memories, save_memory tools       |
|                                                                             |
|   MCP SERVER       Protocol-based integration                               |
|   ----------       Works with any MCP-compatible client                     |
|                                                                             |
+-----------------------------------------------------------------------------+
```

**Quick setup:**

```bash
# As OpenClaw extension
cd ~/.openclaw/extensions
git clone https://github.com/nhevers/moltbrain.git moltbrain
cd moltbrain/integrations/openclaw
npm install && npm run build

# Enable the plugin (required for bundled installations)
pnpm openclaw plugins enable moltbrain

# Or via MCP
npm run mcp:start
```

**Note:** If installing as a bundled extension (in OpenClaw's `extensions/` directory), you must explicitly enable it: `pnpm openclaw plugins enable moltbrain`

See [integrations/openclaw/README.md](integrations/openclaw/README.md) for full setup guide.

<br>

---

## 📚 MoltBook Integration

Works with [MoltBook](https://moltbook.com) - the social network for AI agents! Share memories, learn from other agents, and build collective knowledge.

**Quick setup:**

```bash
# Install MoltBook MCP integration
npm install --save @moltbrain/moltbook-mcp

# Configure in your MoltBrain settings
{
  "MOLTBRAIN_MOLTBOOK_ENABLED": true,
  "MOLTBRAIN_MOLTBOOK_API_URL": "https://moltbook.com"
}
```

See [integrations/moltbook/README.md](integrations/moltbook/README.md) for full setup guide.

<br>

---

## 💻 Claude Code Integration

Works with Claude Code via the plugin marketplace:

```bash
/plugin marketplace add nhevers/moltbrain
/plugin install moltbrain
```

<br>

---

## 📋 Requirements

```
╔══════════════════════════════════════╗
║                                      ║
║   •  Node.js 18+  or  Bun 1.0+      ║
║   •  OpenClaw, MoltBook, or Claude Code ║
║                                      ║
╚══════════════════════════════════════╝
```

<br>

---

## 📄 License

AGPL-3.0

---

<br>

<p align="center">
  <sub>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</sub>
</p>

<p align="center">
  <strong>Built with care for the OpenClaw, MoltBook & Claude Code community</strong>
</p>

<p align="center">
  <a href="https://app.moltbrain.dev">App</a> •
  <a href="https://app.moltbrain.dev/storage">Storage Dapp</a> •
  <a href="https://github.com/nhevers/Moltbrain-virtuals">Virtuals Plugin</a> •
  <a href="https://www.x402.org">x402 Protocol</a>
</p>

<p align="center">
  <sub>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</sub>
</p>
