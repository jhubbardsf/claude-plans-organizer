# Claude Plans Organizer - Developer Documentation

## Project Overview

**Claude Plans Organizer** (`cpo`) is a CLI tool that makes Claude Code plan files human-readable and discoverable. It scans `~/.claude/plans` directory, uses Claude CLI to generate descriptive titles and metadata, and provides an interactive interface to browse, view, copy, and export plans.

### Key Features
- **Intelligent Analysis**: Uses Claude CLI to generate human-readable titles and descriptions for plan files
- **Parallel Processing**: Analyzes multiple plan files concurrently (default: 10 parallel, configurable via `--concurrency`)
- **Smart Caching**: Only re-analyzes files when their content changes (checksum-based)
- **Interactive Browser**: TUI for browsing plans with search and filtering
- **Multiple Commands**: Browse, list, view, copy, export, refresh, stats, projects
- **Project Resolution**: Can resolve which project directory a plan belongs to (by scanning session files)

### Tech Stack
- **Runtime**: Bun (fast JavaScript/TypeScript runtime)
- **Language**: TypeScript with strict mode enabled
- **CLI Framework**: Commander.js for argument parsing
- **UI**: @inquirer/prompts for interactive prompts
- **Styling**: Chalk for terminal colors, Ora for spinners

## Architecture

### Service Layer Pattern
The codebase follows a clean service-oriented architecture with clear separation of concerns:

```
Commands (CLI Interface)
    ↓
PlanService (Orchestrator)
    ↓
├── ScannerService (File Discovery)
├── AnalyzerService (Claude AI Analysis)
└── CacheService (Metadata Persistence)
```

### Core Services

#### 1. **ScannerService** (`src/services/scanner.ts`)
- **Purpose**: Discovers and reads plan files from `~/.claude/plans`
- **Responsibilities**:
  - Scan directory for `.md` files
  - Calculate file checksums
  - Read file content with optional truncation
  - Find plans by partial name match
- **Key Methods**:
  - `scan()`: Returns all plan files sorted by modification date
  - `readContent(path, maxLength)`: Reads file content (truncates if needed)
  - `findByName(query)`: Fuzzy search for plans

#### 2. **AnalyzerService** (`src/services/analyzer.ts`)
- **Purpose**: Uses Claude CLI to generate metadata for plan files
- **Responsibilities**:
  - Execute Claude CLI with structured prompts
  - Parse JSON responses from Claude
  - Provide fallback metadata when analysis fails
  - Rate limiting between analyses
- **Key Methods**:
  - `analyze(planFile)`: Returns `Result<PlanMetadata, string>`
  - `parseAnalysisResult()`: Extracts JSON from Claude's response
  - `fallbackFromFilename()`: Generates metadata from filename when Claude fails
- **Implementation Details**:
  - Uses `zsh -ic` to load shell aliases for `claude-h` command
  - Writes prompts to temp files to handle large content
  - Includes delay mechanism to avoid rate limiting

#### 3. **CacheService** (`src/services/cache.ts`)
- **Purpose**: Persists plan metadata to avoid re-analyzing unchanged files
- **Responsibilities**:
  - Load/save cache from `~/.cache/claude-plans-organizer/metadata.json`
  - Validate cache entries by checksum
  - Prune deleted files from cache
  - Track cache statistics
- **Key Methods**:
  - `load()`: Returns cached metadata
  - `isValid(filename, checksum)`: Checks if cached entry is still valid
  - `set(metadata)`: Stores metadata for a file
  - `prune(existingFilenames)`: Removes stale cache entries
- **Cache Structure**:
  ```typescript
  {
    version: number,
    entries: Record<filename, PlanMetadata>,
    lastUpdated: string
  }
  ```

#### 4. **PlanService** (`src/services/plans.ts`)
- **Purpose**: Orchestrates scanning, caching, and analysis
- **Responsibilities**:
  - Coordinate all other services
  - Determine which files need analysis
  - Provide sorted/filtered plan lists
  - Resolve project directories for plans
- **Key Methods**:
  - `getAllPlans(options)`: Main entry point for loading plans
  - `getPlan(query)`: Find single plan by name or title
  - `getContent(filename)`: Read plan file content
  - `resolveAllProjects()`: Scan session files to determine plan origins

#### 5. **ProjectResolverService** (`src/services/project-resolver.ts`)
- **Purpose**: Determines which project directory a plan was created in
- **Implementation**: Scans `~/.claude/sessions` files for plan references
- **Note**: Slow operation (scans many session files), only runs on-demand

### Commands

All commands are in `src/commands/`:
- **browse**: Interactive TUI (default command)
- **list**: Display plans in table format with sorting/filtering
- **view**: Show full plan content in terminal
- **copy**: Copy plan to clipboard
- **export**: Save plan to custom location
- **refresh**: Force re-analyze plans (clears cache)
- **stats**: Show cache statistics
- **projects**: Resolve project directories for all plans

## Design Patterns

### 1. Type Guards Instead of Type Casting
**Always use runtime validation for type safety:**

```typescript
// ✅ CORRECT: Type guard with runtime validation
export function isAnalysisResult(data: unknown): data is AnalysisResult {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.title === "string" &&
    typeof obj.description === "string" &&
    Array.isArray(obj.tags)
  );
}

// ❌ INCORRECT: Type casting without validation
const parsed = JSON.parse(response) as AnalysisResult;
```

### 2. Result Type Pattern
**Prefer Result types over throwing exceptions for expected errors:**

```typescript
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

// Usage
async function analyze(plan: PlanFile): Promise<Result<PlanMetadata, string>> {
  try {
    const metadata = await doAnalysis(plan);
    return ok(metadata);
  } catch (error) {
    return err(`Failed: ${error.message}`);
  }
}

// Caller handles both cases
const result = await analyzer.analyze(planFile);
if (result.success) {
  console.log(result.data.title);
} else {
  console.error(result.error);
}
```

### 3. Service Composition
**Services are composed through dependency injection:**

```typescript
export class PlanService {
  private cache: CacheService;
  private scanner: ScannerService;
  private analyzer: AnalyzerService;

  constructor(plansDir: string, cacheDir: string) {
    this.cache = new CacheService(cacheDir);
    this.scanner = new ScannerService(plansDir);
    this.analyzer = new AnalyzerService(this.scanner);
  }
}
```

## Type System

### Core Types (`src/types/index.ts`)

```typescript
// Raw file information
interface PlanFile {
  path: string;
  filename: string;
  checksum: string;
  modifiedAt: Date;
  sizeBytes: number;
}

// Enriched metadata (cached)
interface PlanMetadata {
  filename: string;
  checksum: string;
  title: string;
  description: string;
  tags: string[];
  project: string | null;
  analyzedAt: Date;
  modifiedAt: Date;
  sizeBytes: number;
}

// Claude's analysis response
interface AnalysisResult {
  title: string;
  description: string;
  tags: string[];
}
```

### Configuration

Default configuration is in `src/types/index.ts`:

```typescript
export const DEFAULT_CONFIG: Config = {
  plansDirectory: `${process.env.HOME}/.claude/plans`,
  cacheDirectory: `${process.env.HOME}/.cache/claude-plans-organizer`,
  claudeCommand: "claude-d",
  editor: process.env.EDITOR || "vim",
  maxContentLength: 4000,
  analysisDelayMs: 300,
  concurrency: 10,  // Max parallel Claude CLI calls
};
```

The `concurrency` setting can be overridden via the `--concurrency` or `-c` CLI flag:

```bash
cpo browse --concurrency 5   # Use 5 parallel workers
cpo list -c 15              # Use 15 parallel workers
```

## Development Guidelines

### Adding New Commands

1. Create command file in `src/commands/[name].ts`
2. Export an async function that handles the command
3. Register in `src/index.ts`:

```typescript
program
  .command("mycommand")
  .description("What it does")
  .option("-f, --flag", "Flag description")
  .action(myCommandFunction);
```

### Adding New Services

1. Create service class in `src/services/[name].ts`
2. Define clear responsibilities and public interface
3. Inject dependencies via constructor
4. Use Result types for operations that can fail gracefully

### Error Handling Strategy

- **Commands**: Display user-friendly errors with `displayError()` helper
- **Services**: Return `Result<T, E>` for expected failures, throw for unexpected
- **Graceful degradation**: Use fallback metadata when Claude analysis fails
- **User interruption**: Handle Ctrl+C gracefully in interactive commands

### Testing Philosophy

Currently no automated tests. When adding tests:
- Focus on service layer (pure logic)
- Mock file system and Claude CLI calls
- Test type guards thoroughly
- Test cache invalidation logic

## Common Development Tasks

### Testing the CLI Locally

```bash
# Run directly with Bun
bun run src/index.ts browse

# Test specific command
bun run src/index.ts list --sort name

# Install globally for testing
bun link
cpo browse
```

### Debugging Claude Analysis

The analyzer service writes prompts to `/tmp/cpo-prompt-*.txt`. You can:
1. Inspect these files to see what's being sent to Claude
2. Manually run `claude-h -p "$(cat /tmp/cpo-prompt-*.txt)"` to debug
3. Check that `claude-h` alias is available in your shell

### Clearing Cache

```bash
cpo stats              # Check cache status
cpo refresh --all      # Clear all cache
cpo refresh plan.md    # Clear single plan cache
```

### Adding New Metadata Fields

If you need to add fields to `PlanMetadata`:
1. Update `PlanMetadata` interface in `src/types/index.ts`
2. Increment `CACHE_VERSION` in `src/services/cache.ts`
3. Update analyzer prompt in `src/services/analyzer.ts`
4. Update display utilities in `src/utils/display.ts`

## File Organization

```
src/
├── index.ts              # CLI entry point, command registration
├── types/
│   └── index.ts         # All TypeScript types and interfaces
├── services/
│   ├── scanner.ts       # File discovery and reading
│   ├── analyzer.ts      # Claude CLI integration
│   ├── cache.ts         # Metadata persistence
│   ├── plans.ts         # Service orchestrator
│   └── project-resolver.ts  # Project directory resolution
├── commands/
│   ├── browse.ts        # Interactive browser (default)
│   ├── list.ts          # List plans in table
│   ├── view.ts          # View plan content
│   ├── copy.ts          # Copy to clipboard
│   ├── export.ts        # Export to file
│   ├── refresh.ts       # Clear cache
│   ├── stats.ts         # Cache statistics
│   └── projects.ts      # Resolve projects
└── utils/
    ├── checksum.ts      # File checksum calculation
    ├── clipboard.ts     # System clipboard integration
    ├── concurrency.ts   # Parallel processing pool utility
    └── display.ts       # Terminal formatting helpers
```

## Dependencies Overview

- **commander**: CLI argument parsing and subcommands
- **@inquirer/prompts**: Interactive prompts (select, input, etc.)
- **chalk**: Terminal colors and styling
- **ora**: Loading spinners
- **cli-table3**: Table rendering for list command

## Performance Considerations

### Caching Strategy
- Checksums prevent re-analyzing unchanged files
- Cache is loaded once per command invocation
- Batch operations write cache once at the end

### Analysis Rate Limiting
- Default 300ms delay between Claude CLI calls
- Prevents hitting rate limits
- Configurable via `analysisDelayMs`

### Lazy Project Resolution
- Project resolution is slow (scans many session files)
- Only runs when explicitly requested via `projects` command
- Results are cached once resolved

## Security Considerations

- Plan files may contain sensitive information
- Cache files are stored in user's home directory
- No network calls (except through Claude CLI)
- Temporary prompt files are cleaned up after analysis

## Future Improvements

Potential enhancements to consider:
- Search plans by content (not just title/tags)
- Bulk export functionality
- Plan templates
- Integration with Claude Code extension
- Watch mode (auto-refresh on file changes)
- Plan comparison/diff tools
- Archive/delete functionality
