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

### Self-release

This package can release itself. Run from the turl-release directory:

```bash
npm run release
```

## What It Does

1. Loads API key from your project's `.env` file
2. Reads current version from `public/version.json`
3. Increments minor version (1.2 -> 1.3, 1.9 -> 2.0)
4. Removes all `console.log()` calls from src/ files
5. Removes unused CSS classes from src/ files
6. Runs code formatter if available
7. Checks for actual code changes (exits if none)
8. Updates `public/version.json` with new version
9. Generates changelog entry using Grok AI (fails if API call fails)
10. Updates `CHANGELOG.md`
11. Runs production build
12. Stages all changes with `git add -A`
13. Generates commit message using Grok AI (fails if API call fails)
14. Commits and pushes to origin/main

## Error Handling

The release will fail and exit if:
- No `GROK_API_KEY` is found
- The Grok API call fails for changelog generation
- The Grok API call fails for commit message generation
- No changes are detected (graceful exit)

There are no fallback messages. If the AI fails, the release stops to prevent incorrect changelogs or commit messages.

## Project Requirements

Your project should have:

- A `src/` directory with your source code
- A `public/` directory (will be created if missing)
- Git initialized and configured
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
