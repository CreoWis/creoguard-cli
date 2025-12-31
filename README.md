# CreoGuard CLI

AI-powered code review CLI that runs before every commit. Catch bugs, security issues, and best practice violations before they reach your codebase.

## Features

- **Pre-commit Hook**: Automatically reviews code before every commit
- **Company Guidelines**: Import your company's coding standards from PDF/Markdown
- **Multiple LLM Providers**: Supports OpenAI, Anthropic Claude, and Ollama (local)
- **BYOK (Bring Your Own Key)**: Uses your own API keys - no subscription required
- **Git-provider Agnostic**: Works with GitHub, GitLab, Bitbucket, or any Git repository
- **Configurable Rules**: Customize what to check and what to ignore
- **Beautiful Terminal Output**: Clear, colorful issue reports with fix suggestions

## Installation

```bash
npm install -g creoguard-cli
```

## Quick Start

### 1. Configure your API key

```bash
# For OpenAI (default)
creoguard config set provider openai
creoguard config set apiKey sk-your-openai-api-key

# For Anthropic Claude
creoguard config set provider anthropic
creoguard config set apiKey sk-ant-your-anthropic-key

# For Ollama (free, local)
creoguard config set provider ollama
creoguard config set ollamaUrl http://localhost:11434
creoguard config set ollamaModel codellama
```

### 2. Initialize in your repository

```bash
cd your-project
creoguard init
```

### 3. Commit your code

```bash
git add .
git commit -m "feat: add new feature"
# CreoGuard automatically reviews your staged changes
```

## Commands

### `creoguard init`

Initialize CreoGuard in the current Git repository. Sets up the pre-commit hook and creates configuration files.

```bash
creoguard init
creoguard init --force  # Reinitialize, overwriting existing config
```

### `creoguard config`

Manage CreoGuard configuration.

```bash
# Set a config value
creoguard config set apiKey sk-xxxxx
creoguard config set provider openai
creoguard config set model gpt-4o-mini

# Get a config value
creoguard config get provider

# List all config
creoguard config list

# Reset to defaults
creoguard config reset
```

### `creoguard review`

Review code changes manually.

```bash
creoguard review              # Review staged changes (default)
creoguard review --staged     # Review staged changes
creoguard review --all        # Review all uncommitted changes
creoguard review --files src/app.ts src/utils.ts  # Review specific files
creoguard review --verbose    # Show detailed output
```

### `creoguard check`

Check a specific file for issues.

```bash
creoguard check src/auth/login.ts
creoguard check src/auth/login.ts --verbose
```

### `creoguard enable / disable`

Temporarily enable or disable the pre-commit hook.

```bash
creoguard disable  # Skip reviews temporarily
creoguard enable   # Re-enable reviews
```

### `creoguard guidelines`

Manage company coding guidelines and best practices. CreoGuard will use these guidelines to provide company-specific code review feedback.

```bash
# Add project-specific guidelines (stored in .creoguard/guidelines.pdf)
creoguard guidelines add ./company-coding-standards.pdf

# Add global guidelines (applies to all repos)
creoguard guidelines add --global ~/Documents/company-guidelines.pdf

# Show current guidelines configuration
creoguard guidelines show
creoguard guidelines show --verbose  # Show content preview

# Remove guidelines
creoguard guidelines remove          # Remove project guidelines
creoguard guidelines remove --global # Remove global guidelines
```

Supported file formats:
- **PDF**: Company coding standards documents
- **Markdown** (.md): Guidelines in markdown format
- **Text** (.txt): Plain text guidelines

## Configuration

### Global Configuration

Located at `~/.creoguard/config.json`:

```json
{
  "provider": "openai",
  "apiKey": "sk-xxxxx",
  "model": "gpt-4o-mini",
  "ollamaUrl": "http://localhost:11434",
  "ollamaModel": "codellama"
}
```

### Project Configuration

Located at `.creoguard/config.json` in your repository:

```json
{
  "enabled": true,
  "reviewLevel": "standard",
  "blockOnCritical": true,
  "ignore": [
    "*.test.ts",
    "*.spec.ts",
    "dist/**",
    "node_modules/**"
  ],
  "rules": {
    "security": "error",
    "performance": "warn",
    "bestPractices": "warn",
    "codeStyle": "warn"
  },
  "customPrompt": "Also check for React hooks violations"
}
```

### Configuration Options

| Option | Values | Description |
|--------|--------|-------------|
| `enabled` | `true`, `false` | Enable/disable CreoGuard for this repo |
| `reviewLevel` | `strict`, `standard`, `relaxed` | How thorough the review should be |
| `blockOnCritical` | `true`, `false` | Block commits with critical issues |
| `ignore` | `string[]` | Glob patterns for files to skip |
| `rules.security` | `error`, `warn`, `off` | Security issue severity |
| `rules.performance` | `error`, `warn`, `off` | Performance issue severity |
| `rules.bestPractices` | `error`, `warn`, `off` | Best practices severity |
| `rules.codeStyle` | `error`, `warn`, `off` | Code style severity |
| `customPrompt` | `string` | Additional review instructions |
| `guidelinesPath` | `string` | Path to custom guidelines file |
| `useGlobalGuidelines` | `true`, `false` | Whether to include global guidelines |

## Supported LLM Providers

### OpenAI

```bash
creoguard config set provider openai
creoguard config set apiKey sk-your-key
creoguard config set model gpt-4o-mini  # or gpt-4o, gpt-4-turbo
```

### Anthropic Claude

```bash
creoguard config set provider anthropic
creoguard config set apiKey sk-ant-your-key
creoguard config set model claude-sonnet-4-20250514  # or claude-3-5-sonnet, claude-3-haiku
```

### Ollama (Free, Local)

Run AI models locally without API costs.

1. Install Ollama: https://ollama.ai
2. Pull a model: `ollama pull codellama`
3. Configure CreoGuard:

```bash
creoguard config set provider ollama
creoguard config set ollamaUrl http://localhost:11434
creoguard config set ollamaModel codellama
```

## Example Output

```
  ╭──────────────────────────────────────────────────────╮
  │  CreoGuard reviewing 3 staged files...               │
  ╰──────────────────────────────────────────────────────╯

  Reviewing src/auth/login.ts ············· done
  Reviewing src/auth/utils.ts ············· done
  Reviewing src/api/routes.ts ············· done

  ┌─ src/auth/login.ts ──────────────────────────────────
  │
  │  ✖ CRITICAL [line 45] SQL Injection Vulnerability
  │
  │    Current:
  │    │ - const query = `SELECT * FROM users WHERE id = '${userId}'`
  │
  │    Suggested fix:
  │    │ + const query = 'SELECT * FROM users WHERE id = $1'
  │    │ + await db.query(query, [userId])
  │
  └──────────────────────────────────────────────────────

  ╭──────────────────────────────────────────────────────╮
  │  ✖ Commit blocked: 1 critical issue must be fixed    │
  ╰──────────────────────────────────────────────────────╯
```

## Company Guidelines

CreoGuard can enforce your company's specific coding standards alongside general best practices. This ensures code reviews are tailored to your organization's requirements.

### How It Works

1. **Add your guidelines** (PDF or Markdown):
   ```bash
   creoguard guidelines add ./coding-standards.pdf
   ```

2. **Guidelines are included in reviews**: When reviewing code, CreoGuard will:
   - Apply standard security, performance, and best practice checks
   - Additionally check against your company's specific rules
   - Flag violations with the `companyGuidelines` category

### Guidelines Priority

- **Project guidelines** (`.creoguard/guidelines.*`) take precedence
- **Global guidelines** (`~/.creoguard/guidelines.*`) apply to all repos
- Both can be used together (project + global)
- Disable global guidelines per-project with `"useGlobalGuidelines": false`

### Example Guidelines Content

Your PDF or Markdown can include rules like:
- Naming conventions (e.g., "Use camelCase for variables")
- Architecture patterns (e.g., "All API calls must go through the ApiService")
- Security requirements (e.g., "Never log PII data")
- Code organization (e.g., "Keep functions under 50 lines")
- Framework-specific rules (e.g., "Use React Query for data fetching")

## Bypassing Reviews

If you need to skip the review for a specific commit:

```bash
git commit --no-verify -m "emergency fix"
```

Or temporarily disable CreoGuard:

```bash
creoguard disable
git commit -m "skip review"
creoguard enable
```

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.
