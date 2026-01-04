<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with this repository.

## Project Overview

This is an **AI News Reading Assistant** (AI 稍后阅读助手) - a Cubox-style "Read It Later" application that supports multi-modal content collection (articles, videos, audio), AI-powered summaries, and custom tagging/categorization. Built with Next.js 15 and Supabase.

**Key Features:**
- Multi-modal content collection (URLs, manual text entries, file uploads)
- Dashboard with category navigation (uncategorized, all, starred, today, folders, smart lists)
- Infinite scroll with automatic pagination
- Batch operations (star, move, tag, archive, delete, export)
- Advanced reader page with multiple view modes (reader, web view, AI brief, archive)
- Supabase Storage integration for user-uploaded files
- Knowledge base with smart topics clustering
- Annotation system with text highlights and comments
- Settings center with appearance, account, and rewards management
- Full-text search and filtering capabilities

## Development Commands

```bash
# Install dependencies
npm install

# Run development server (defaults to http://localhost:3000)
# Note: Strips OPENAI_* env vars in dev mode to prevent accidental AI usage
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## Technology Stack

- **Framework**: Next.js 15 (App Router) with React 19
- **Authentication**: Supabase Auth with cookie-based sessions via `@supabase/ssr`
- **Database**: PostgreSQL via Supabase with Row Level Security (RLS)
- **Storage**: Supabase Storage (bucket: `user-files`)
- **Styling**: Tailwind CSS + shadcn/ui components (new-york style)
- **UI Components**: Radix UI primitives
- **Animations**: Framer Motion
- **Data Visualization**: @antv/g6, react-force-graph-2d
- **Video**: Video.js
- **Utilities**:
  - JSZip (batch export)
  - Turndown (HTML to Markdown conversion)
  - Lucide React (icons)
  - Cheerio (HTML parsing)
  - Tencent Cloud ASR (audio transcription)

## Project Architecture

### Core Directory Structure

```
app/
├── auth/                   # Authentication pages (login, signup, password reset)
├── dashboard/              # Main collection workspace
├── notes/[id]/            # Individual note reader page
├── api/                   # API routes
│   ├── capture/           # Web content capture endpoint
│   └── tags/              # Tag management endpoints
├── layout.tsx             # Root layout with theme provider
└── page.tsx               # Landing page

components/
├── dashboard/             # Dashboard-specific components
│   ├── dashboard-content.tsx    # Main dashboard logic (infinite scroll, batch ops)
│   └── dashboard-auth-check.tsx # Auth wrapper
├── reader/                # Reader layout and sub-components
│   ├── ReaderLayout.tsx   # Main 3-column layout with Zen mode
│   ├── GlobalHeader/      # Top navigation (view switcher, appearance, actions)
│   ├── LeftSidebar/       # Article outline, video chapters
│   ├── ContentStage/      # Main content area (article, video, AI brief, archive)
│   └── RightSidebar/      # Annotations, AI analysis, transcript
├── settings/              # Settings center sections
│   ├── sections/          # Individual settings panels (account, appearance, etc.)
├── ui/                    # shadcn/ui base components
└── tutorial/              # Onboarding tutorial components

lib/
├── supabase/
│   ├── client.ts          # Client-side Supabase client
│   ├── server.ts          # Server-side Supabase client
│   └── proxy.ts           # Middleware for auth and protected routes
└── services/
    ├── jina.ts            # Jina Reader API integration
    ├── openai.ts          # OpenAI API integration
    ├── tencent-asr.ts     # Tencent Cloud ASR for audio transcription
    ├── knowledge-topics.ts # Smart topics clustering
    ├── knowledge-graph.ts # Knowledge graph visualization
    └── snapshot.ts        # HTML snapshot management

supabase/
└── migrations/            # Database schema migrations (001-008)
```

### Database Schema (Key Tables)

- **profiles**: User profile extensions
- **folders**: Collection folders/categories with hierarchy support
- **notes**: Core content items (articles/videos/audio)
  - Unique constraint: `(user_id, source_url)`
  - Supports: `content_type` (article/video/audio), `status` (unread/reading/archived)
- **tags**: User-defined tags with color/icon support (supports parent-child hierarchy)
- **note_tags**: Many-to-many relationship between notes and tags
- **annotations**: Text highlights and annotations on notes
- **reading_progress**: Tracks reading position and percentage
- **snapshots**: Archived HTML snapshots of web pages
- **knowledge_topics**: Auto-generated topic clusters
- **knowledge_notes**: Many-to-many relationship between notes and topics
- **settings**: User settings and preferences

### Supabase Integration Patterns

#### Authentication Flow
- Uses cookie-based sessions via `@supabase/ssr`
- Middleware (`lib/supabase/proxy.ts`) protects routes: `/dashboard`, `/protected`, `/notes/*`
- Protected paths configured in `protectedPaths` array in middleware
- Authenticated users redirected away from auth pages (except error/confirm/update-password)

#### Client vs Server Supabase Usage
- **Client-side** (`lib/supabase/client.ts`): Use in Client Components, event handlers
- **Server-side** (`lib/supabase/server.ts`): Use in Server Components, Server Actions, API routes
- **Important**: Always create fresh server clients per request (Fluid compute requirement)

#### Storage Bucket
- Bucket name: `user-files` (configurable via `NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET`)
- Used for image/video/file uploads from "Add Note" modal
- Access pattern: `supabase.storage.from(STORAGE_BUCKET).upload(path, file)`

### Key Component Patterns

#### Dashboard (`components/dashboard/dashboard-content.tsx`)
- **Infinite Scroll**: Uses `IntersectionObserver` with sentinel element at bottom
- **Batch Operations**: Multi-select mode with global action bar
- **Smart Lists**: Auto-generated lists based on tag frequency and common sources
- **Add Note Modal**: 3 tabs (URL, Manual Text, File Upload)
- **防盗链处理**: All images use `referrerPolicy="no-referrer"` to bypass hotlink protection

#### Reader Layout (`components/reader/ReaderLayout.tsx`)
- **3-Column Layout**: Left sidebar (outline/chapters) + Content stage + Right sidebar (annotations/AI)
- **View Modes**: `reader` (default), `web` (iframe), `ai-brief`, `archive`, `ai-snapshot`
- **Zen Mode**: Press `Esc` to collapse sidebars for distraction-free reading
- **Scroll Progress**: Top progress bar tracks reading position
- **Selection Menu**: Floating toolbar appears on text selection for annotations

#### Content Stage Components
- **ArticleReader** (`ContentStage/ArticleReader.tsx`): Sanitized HTML content display with reading progress
- **VideoPlayer** (`ContentStage/VideoPlayer.tsx`): Video.js integration with chapter navigation
- **WebView** (`ContentStage/WebView.tsx`): iframe embed for original site
- **AIBriefView** (`ContentStage/AIBriefView.tsx`): AI-generated summary display
- **ArchiveView** (`ContentStage/ArchiveView.tsx``): Read/archived view
- **AISnapshotView** (`ContentStage/AISnapshotView.tsx`): Persistent AI snapshot view

#### Protected Routes Pattern
```tsx
// Wrap page content with auth check
<DashboardAuthCheck>
  <DashboardContent />
</DashboardAuthCheck>
```

### API Route Patterns

- **POST /api/capture**: Captures web content (basic fetch-based scraper)
  - Input: `{ noteId, url }`
  - Validates note ownership before capture
- **Tag Management**: CRUD operations for tags with reordering and archiving support

### Service Layer Patterns

Services in `lib/services/` encapsulate external API integrations:

- **jina.ts**: Uses Jina Reader API for premium content extraction (fallback when basic scraper fails)
- **openai.ts**: OpenAI-compatible API for AI features (summaries, topic naming, embeddings)
- **tencent-asr.ts**: Audio/video transcription using Tencent Cloud ASR
- **knowledge-topics.ts**: Clustering algorithm for smart topic generation
- **knowledge-graph.ts**: Graph visualization data preparation
- **snapshot.ts**: HTML snapshot creation and persistence

## Environment Variables

Required variables (see `.env.example`):
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Optional:
```bash
# Server-side (for cron / admin jobs)
SUPABASE_SERVICE_ROLE_KEY=

# Cron security (for nightly refresh)
KNOWLEDGE_CRON_SECRET=
SMART_TOPICS_REFRESH_URL=

# AI Services - Primary OpenAI-compatible API
OPENAI_API_KEY=your_openai_api_key
OPENAI_API_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini

# Knowledge Smart Topics (P1)
# Embeddings provider (must support /embeddings endpoint)
KNOWLEDGE_EMBEDDING_API_KEY=
KNOWLEDGE_EMBEDDING_BASE_URL=https://api.openai.com/v1
KNOWLEDGE_EMBEDDING_MODEL=text-embedding-3-small

# Topic naming provider (can be same as OPENAI_*)
KNOWLEDGE_TOPIC_NAMING_API_KEY=
KNOWLEDGE_TOPIC_NAMING_BASE_URL=
KNOWLEDGE_TOPIC_NAMING_MODEL=

# Smart Topics incremental matching threshold
KNOWLEDGE_TOPIC_MATCH_THRESHOLD=0.85

# Tencent Cloud (for ASR)
TENCENT_SECRET_ID=your_tencent_secret_id
TENCENT_SECRET_KEY=your_tencent_secret_key

# Jina Reader (for premium content extraction)
JINA_API_KEY=your_jina_api_key

# Supabase Storage (default bucket name)
NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET=user-files
```

## Common Development Workflows

### Adding a New Protected Page
1. Create page in `app/your-route/page.tsx`
2. Add route pattern to `lib/supabase/proxy.ts` in `protectedPaths` array
3. Wrap content with auth check component or use `createClient()` server-side

### Working with Supabase
- **Server Components**: Use `createClient()` from `lib/supabase/server.ts`
- **Client Components**: Use `createClient()` from `lib/supabase/client.ts`
- **API Routes**: Use server client, always check `supabase.auth.getUser()`

### Running Database Migrations
```bash
# Migrations are in supabase/migrations/*.sql
# Apply via Supabase CLI or dashboard SQL editor
supabase db push  # If using Supabase CLI
```

### Adding New UI Components
- Use shadcn/ui patterns: `npx shadcn@latest add [component-name]`
- Components generate in `components/ui/`
- Already configured via `components.json` with "new-york" style

### Handling Image Hotlinking Issues
- Always add `referrerPolicy="no-referrer"` to `<img>` tags
- Common for WeChat public account images and similar sources

### Adding External Service Integrations
1. Create service file in `lib/services/[name].ts`
2. Add environment variables to `.env.example`
3. Export functions and use in Server Actions or API routes
4. Handle errors gracefully with fallback behavior

## OpenSpec Workflow

This project uses OpenSpec for spec-driven development. Key commands and patterns:

### OpenSpec Commands
```bash
# List all active changes
openspec list

# List all existing capabilities/specs
openspec list --specs

# Validate a change proposal
openspec validate <change-id> --strict

# Show details of a change or spec
openspec show <change-id>
openspec show <spec> --type spec

# Archive a completed change
openspec archive <change-id> --skip-specs --yes
```

### Creating New Changes
1. **Review context**: Check `openspec/project.md`, run `openspec list` and `openspec list --specs`
2. **Choose change-id**: Use kebab-case, verb-led naming (`add-`, `update-`, `remove-`, `refactor-`)
3. **Scaffold structure**: Create `proposal.md`, `tasks.md`, optional `design.md`, and spec deltas under `openspec/changes/<id>/`
4. **Write spec deltas**: Use `## ADDED|MODIFIED|REMOVED Requirements` with at least one `#### Scenario:` per requirement
5. **Validate**: Run `openspec validate <change-id> --strict` before implementation
6. **Get approval**: Do not start implementation until proposal is approved

### Implementing Changes
1. Read `proposal.md` to understand what's being built
2. Read `design.md` (if exists) to review technical decisions
3. Read `tasks.md` to get implementation checklist
4. Implement tasks sequentially in order
5. Update checklist by marking tasks as `- [x]` after completion

### Archiving Changes
After deployment:
- Move `changes/[name]/` → `changes/archive/YYYY-MM-DD-[name]/`
- Update `specs/` if capabilities changed
- Run `openspec archive <change-id>` with appropriate flags
- Validate with `openspec validate --strict`

### When to Create Proposals
**Create proposals for:**
- Adding features or functionality
- Making breaking changes (API, schema)
- Changing architecture or patterns
- Optimizing performance (changes behavior)
- Updating security patterns

**Skip proposals for:**
- Bug fixes (restore intended behavior)
- Typos, formatting, comments
- Dependency updates (non-breaking)
- Configuration changes
- Tests for existing behavior

## Active Specs (Capabilities)

Current capabilities defined in `openspec/specs/`:
- **ai-summaries**: AI-generated summaries and briefs
- **annotations**: Text highlighting and annotation system
- **auth**: Authentication and user management
- **capture**: Content capture from URLs, manual input, file uploads
- **dashboard**: Main dashboard view and navigation
- **landing-page**: Public landing page
- **library**: Content organization, folders, tags, search
- **sharing**: Annotation and content sharing

## Code Style Guidelines

- **TypeScript**: Strict mode enabled, prefer type inference
- **Components**: Prefer Client Components (`"use client"`) for interactive features
- **Imports**: Use `@/` alias for absolute imports from project root
- **Tailwind**: Use utility classes; custom styles only when necessary
- **File naming**:
  - Components: PascalCase (e.g., `ReaderLayout.tsx`)
  - Utilities: kebab-case (e.g., `auth-helpers.ts`)
  - Pages: lowercase (e.g., `page.tsx`)

## Important Notes

- **Reader referrerpolicy**: Images require `referrerPolicy="no-referrer"` for hotlink protection bypass
- **Middleware auth**: Don't modify middleware cookie handling - breaks session persistence
- **Supabase RLS**: All tables have Row Level Security policies; queries auto-filter by authenticated user
- **Fluid compute**: Always create fresh Supabase server clients (never cache globally)
- **Unique constraints**: Notes table enforces `(user_id, source_url)` uniqueness to prevent duplicates
- **OpenSpec validation**: Always run `openspec validate --strict` before submitting proposals
- **Dev mode AI**: The `dev` script strips OPENAI_* env vars to prevent accidental AI API usage during development
- **CSP headers**: Content Security Policy configured in `next.config.ts` - modify with caution
