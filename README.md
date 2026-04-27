# Claude Plans Organizer 📋

> Transform your Claude Code plan files into an organized, searchable library with human-readable titles

## What is this?

When you use Claude Code's plan mode, it creates plan files in `~/.claude/plans` with names like `1733956987164-bdb8f1b2db294f8ab1a7dd34d7d1b33f.md`. These filenames are timestamps and hashes - impossible to browse or remember.

**Claude Plans Organizer** (`cpo`) solves this by:
- 🤖 Using Claude AI to generate descriptive titles and summaries for each plan
- 💾 Caching metadata so it's instant after the first scan
- 🔍 Providing an interactive browser to search and view your plans
- 📋 Making it easy to copy, export, or edit plans

## Quick Start

### Prerequisites

- **Bun** - Fast JavaScript runtime ([install here](https://bun.sh))
- **Claude CLI** - Required for analyzing plans
  - The tool uses the `claude-h` command (you need this alias configured)
  - Make sure `claude-h` works in your shell before using `cpo`

### Installation

#### Option 1: Install Globally (Recommended)

```bash
# Clone the repository
git clone https://github.com/yourusername/claude-plans-organizer.git
cd claude-plans-organizer

# Install dependencies
bun install

# Link globally (makes 'cpo' command available everywhere)
bun link

# Now you can use it from anywhere!
cpo
```

#### Option 2: Run Locally

```bash
git clone https://github.com/yourusername/claude-plans-organizer.git
cd claude-plans-organizer
bun install

# Run directly
bun run src/index.ts
```

## Usage

### Interactive Browser (Default)

Simply run `cpo` to launch the interactive browser:

```bash
cpo
# or
cpo browse
```

This will:
1. Scan your `~/.claude/plans` directory
2. Analyze new/changed files with Claude (one-time per file)
3. Display an interactive list of plans with human-readable titles
4. Let you view, copy, export, or edit plans

**Demo:**
```
✓ Found 15 plan files
✓ Loaded 15 plans

? Select a plan: (Use arrow keys)
  01. JWT Authentication Implementation · 2 days ago · 8.2 KB
  02. Database Schema Refactoring · 3 days ago · 12.1 KB
  03. React Component Modernization · 1 week ago · 6.5 KB
  ...
```

### List All Plans

Display all plans in a table format:

```bash
# Basic list
cpo list

# Sort by name
cpo list --sort name

# Sort by size
cpo list --sort size

# Reverse order
cpo list --reverse

# Limit results
cpo list --limit 10

# Filter by tag
cpo list --tag feature

# JSON output (for scripts)
cpo list --json
```

**Example output:**
```
┌────┬─────────────────────────────────────────┬──────────────┬─────────┐
│ #  │ Title                                   │ Date         │ Size    │
├────┼─────────────────────────────────────────┼──────────────┼─────────┤
│ 1  │ JWT Authentication Implementation       │ 2 days ago   │ 8.2 KB  │
│ 2  │ Database Schema Refactoring             │ 3 days ago   │ 12.1 KB │
│ 3  │ React Component Modernization           │ 1 week ago   │ 6.5 KB  │
└────┴─────────────────────────────────────────┴──────────────┴─────────┘
```

### View a Plan

View the full content of a plan in your terminal:

```bash
# By filename
cpo view 1733956987164-bdb8f1b2db294f8ab1a7dd34d7d1b33f.md

# By partial match (finds first match)
cpo view jwt-auth

# Alias
cpo show jwt-auth
```

### Copy to Clipboard

Copy a plan's content to your clipboard:

```bash
cpo copy jwt-auth
# or
cpo cp jwt-auth
```

### Export to File

Save a plan to a custom location:

```bash
# Export with custom name
cpo export jwt-auth ./my-plan.md

# Export to current directory (uses original filename)
cpo export jwt-auth .

# Alias
cpo save jwt-auth ./exported-plan.md
```

### Refresh Cache

Force re-analyze plans (useful if analysis failed or you want updated titles):

```bash
# Refresh all plans
cpo refresh --all

# Refresh specific plan
cpo refresh jwt-auth.md
```

### View Statistics

See cache statistics and directory info:

```bash
cpo stats
```

**Example output:**
```
Cache Statistics
━━━━━━━━━━━━━━━━
Total plans: 15
Cached plans: 15
Plans directory: /Users/josh/.claude/plans
Cache file: /Users/josh/.cache/claude-plans-organizer/metadata.json
Last updated: 2024-12-13T20:30:45.123Z
```

### Resolve Projects

Determine which project directory each plan belongs to (slow - scans session files):

```bash
cpo projects
```

This scans `~/.claude/sessions` to find where each plan was created. Results are cached.

## Commands Reference

| Command | Aliases | Description |
|---------|---------|-------------|
| `cpo` | `cpo browse` | Interactive plan browser (default) |
| `cpo list` | `cpo ls` | List all plans in table format |
| `cpo view <plan>` | `cpo show` | View a plan's content |
| `cpo copy <plan>` | `cpo cp` | Copy plan to clipboard |
| `cpo export <plan> [dest]` | `cpo save` | Export plan to file |
| `cpo refresh [plan]` | | Force re-analyze plans |
| `cpo stats` | | Show cache statistics |
| `cpo projects` | | Resolve project directories (slow) |

### Command Options

**List command options:**
```bash
-s, --sort <by>     # Sort by: date, name, size (default: date)
-r, --reverse       # Reverse sort order
-n, --limit <n>     # Limit number of results
-t, --tag <tag>     # Filter by tag (feature, bugfix, etc.)
-j, --json          # Output as JSON
```

**Refresh command options:**
```bash
-a, --all          # Refresh all plans (vs. single plan)
```

## How It Works

### First Run
1. Scans `~/.claude/plans` for `.md` files
2. Sends each plan to Claude CLI with a structured prompt
3. Claude returns JSON with `title`, `description`, and `tags`
4. Metadata is cached in `~/.cache/claude-plans-organizer/metadata.json`

### Subsequent Runs
1. Scans plans directory
2. Checks file checksums against cache
3. Only analyzes **new or modified** files
4. Loads instantly from cache for unchanged files

### Cache Invalidation
- Cache is automatically invalidated when a plan file's content changes (checksum-based)
- You can manually refresh with `cpo refresh --all`
- Cache version bumps require full rebuild

## Configuration

### Environment Variables

- `HOME` - Required (determines plan and cache directories)
- `EDITOR` - Used for the "edit" action (defaults to `vim`)

### Directories

- **Plans**: `~/.claude/plans` (where Claude Code stores plans)
- **Cache**: `~/.cache/claude-plans-organizer/metadata.json` (generated metadata)

### Claude CLI Setup

The tool expects `claude-h` to be available in your shell. This should be an alias or command that:
- Accepts `-p` flag for prompts
- Returns text output
- Exits with code 0 on success

Example alias (add to `.zshrc` or `.bashrc`):
```bash
alias claude-h='claude --model haiku'
```

## Tips & Tricks

### Fast Searching
When using `cpo browse`, you can type to filter the list in real-time.

### Fuzzy Matching
Commands accept partial matches:
```bash
# All of these work if you have a plan about "authentication"
cpo view auth
cpo view authentication
cpo view jwt-auth
cpo copy 1733956987164  # partial filename
```

### Tag Filtering
Claude automatically tags plans. Common tags:
- `feature` - New functionality
- `bugfix` - Bug fixes
- `refactoring` - Code improvements
- `api` - API-related work
- `ui` - User interface changes
- `database` - Database work
- `auth` - Authentication/authorization
- `performance` - Performance improvements

Filter by tag:
```bash
cpo list --tag feature
cpo list --tag bugfix
```

### JSON Output for Scripting
```bash
# Get all plans as JSON
cpo list --json | jq '.[] | select(.tags | contains(["feature"]))'

# Count plans by tag
cpo list --json | jq '[.[] | .tags[]] | group_by(.) | map({tag: .[0], count: length})'
```

### Export Multiple Plans
```bash
# Export recent plans
for plan in $(cpo list --limit 5 --json | jq -r '.[].filename'); do
  cpo export "$plan" "./exports/$plan"
done
```

## Troubleshooting

### "No plans found"
- Check that `~/.claude/plans` exists and has `.md` files
- Run Claude Code in plan mode to generate some plans first

### "Claude CLI failed"
- Verify `claude-h` works: `claude-h -p "Hello"`
- Check that your shell loads aliases (tool uses `zsh -ic`)
- Make sure Claude CLI is authenticated

### Analysis is slow
- First run analyzes all plans (one API call per plan)
- Subsequent runs only analyze new/changed files
- Adjust `analysisDelayMs` in config if hitting rate limits

### Cache is stale
```bash
# Clear all cache and re-analyze
cpo refresh --all

# Clear specific plan
cpo refresh <plan-name>.md
```

### TypeScript errors
```bash
# Type check without running
bun run typecheck
```

## Development

See [CLAUDE.md](./CLAUDE.md) for developer documentation, including:
- Architecture and design patterns
- Service layer details
- Type system
- Adding new commands
- Contributing guidelines

## Requirements

- **Bun**: v1.3.3 or later
- **TypeScript**: v5.x (peer dependency)
- **Claude CLI**: Must have `claude-h` command available
- **OS**: macOS/Linux (uses standard shell features)

## License

MIT

## Author

Built with Claude Code by [@joshfinnie](https://github.com/joshfinnie) (update with your GitHub username)

## Acknowledgments

- Built with [Bun](https://bun.sh) - Fast all-in-one JavaScript runtime
- Uses [Commander.js](https://github.com/tj/commander.js) for CLI parsing
- Interactive prompts via [@inquirer/prompts](https://github.com/SBoudrias/Inquirer.js)
- Terminal styling with [Chalk](https://github.com/chalk/chalk)
