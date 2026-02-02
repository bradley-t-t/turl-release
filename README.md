# turl-release

A CLI tool for automated semantic versioning, cleanup, changelog generation, and release commits for React and React + Vite projects.

by Trent

## Installation

Install as a dev dependency in your React project:

```bash
npm install --save-dev /path/to/turl-release
```

Or link globally for development:

```bash
cd /path/to/turl-release
npm link
```

Then in your project:

```bash
npm link turl-release
```

## Configuration

### API Key

Each project using turl-release must provide its own API key.

Create a `.env` file in your project root:

```
GROK_API_KEY=your-xai-grok-api-key
```

Get your API key from https://console.x.ai

Add `.env` to your project's `.gitignore`:

```
.env
```

The tool uses the `grok-3-latest` model for changelog and commit message generation.

### Project Configuration (turl.json)

Create a `public/turl.json` file in your project (will be auto-created with defaults if missing):

```json
{
  "version": "1.0",
  "projectName": "my-project",
  "branch": "main"
}
```

- **version**: Current version number (auto-incremented on each release)
- **projectName**: Used in commit messages (e.g., "my-project: Release v1.2")
- **branch**: Default branch to push to (can be overridden via CLI)

## Usage

### Option 1: npx (recommended)

From your project root:

```bash
npx turl-release
```

### Option 2: npm script

Add to your project's `package.json`:

```json
{
  "scripts": {
    "release": "turl-release"
  }
}
```

Then run:

```bash
npm run release
```

### Command Line Options

```bash
turl-release --branch <name>   # Override branch (e.g., --branch develop)
turl-release -b <name>         # Short form
turl-release --help            # Show help
```

Example with branch override:

```bash
npx turl-release --branch develop
npm run release -- --branch feature/my-branch
```

### Self-release

This package can release itself. Run from the turl-release directory:

```bash
npm run release
```

## What It Does

1. Loads API key from your project's `.env` file
2. Reads config from `public/turl.json` (version, projectName, branch)
3. Increments minor version (1.2 -> 1.3, 1.9 -> 2.0)
4. Removes all `console.log()` calls from src/ files
5. Removes unused CSS classes from src/ files
6. Runs code formatter if available
7. Checks for actual code changes (exits if none)
8. Updates `public/turl.json` with new version
9. Generates changelog entry using Grok AI (fails if API call fails)
10. Updates `CHANGELOG.md`
11. Runs production build
12. Stages all changes with `git add -A`
13. Generates commit message using Grok AI with project name (e.g., "my-project: Release v1.3")
14. Commits and pushes to configured branch

## Error Handling

The tool includes comprehensive error handling with clear messages and suggestions:

### Pre-flight Checks

- Git installation verification
- Git repository initialization check
- Git remote configuration check
- node_modules existence check

### API Errors

- Missing API key detection
- Invalid API key format validation
- Network connectivity errors (DNS, timeout, connection refused)
- Rate limiting detection
- Server errors (5xx)
- Invalid response format detection

### File System Errors

- Permission denied (EACCES)
- File not found (ENOENT)
- No disk space (ENOSPC)
- Read-only file system (EROFS)
- Invalid JSON parsing

### Git Errors

- Push rejected (non-fast-forward)
- Authentication failures
- Remote not found
- Commit failures

### Build/Format Errors

- Missing prettier detection
- Build failure handling
- Format command availability

The release will fail and exit if:

- No `GROK_API_KEY` is found in project .env
- Git is not installed or not a repository
- The Grok API call fails for changelog generation
- The Grok API call fails for commit message generation
- No changes are detected (graceful exit)

There are no fallback messages. If the AI fails, the release stops to prevent incorrect changelogs or commit messages.

### Debug Mode

Set `DEBUG=1` to see full stack traces on errors:

```bash
DEBUG=1 npx turl-release
```

## Project Requirements

Your project should have:

- A `src/` directory with your source code
- A `public/` directory (will be created if missing)
- A `public/turl.json` file (will be created with defaults if missing)
- A `.env` file with `GROK_API_KEY`
- Git initialized and configured with a remote
- One of: `npm run build`, Vite, or Create React App

## Supported Project Types

- Create React App
- Vite + React
- Any React project with standard structure

## Version Format

Versions follow the format `MAJOR.MINOR`:

- `1.0` -> `1.1` -> `1.2` ... -> `1.9` -> `2.0`

## License

ISC
