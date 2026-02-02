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

The API key is pre-configured in the turl-release package itself. You do NOT need to add any `.env` file to your individual projects.

If you need to update the API key, edit the `.env` file in the turl-release package directory:

```
GROK_API_KEY=your-xai-grok-api-key
```

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

## What It Does

1. Loads API key from turl-release package (no project config needed)
2. Reads current version from `public/version.json`
3. Increments minor version (1.2 -> 1.3, 1.9 -> 2.0)
4. Removes all `console.log()` calls from src/ files
5. Removes unused CSS classes from src/ files
6. Runs code formatter if available
7. Checks for actual code changes
8. Updates `public/version.json` with new version
9. Generates smart changelog entry using Grok AI
10. Updates `CHANGELOG.md`
11. Runs production build
12. Commits with AI-generated message
13. Pushes to origin/main

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
