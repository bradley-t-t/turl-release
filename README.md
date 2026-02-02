# turl-release

> Automated semantic versioning, cleanup, changelog generation, and release commits for React projects.

by Trent

---

## Quick Start

```bash
npm install --save-dev turl-release
```

Add to your `package.json`:

```json
{
  "scripts": {
    "release": "turl-release"
  }
}
```

Create `.env` in your project root:

```
GROK_API_KEY=your-xai-api-key
```

Run:

```bash
npm run release
```

---

## Configuration

### 1. API Key (Required)

Get your API key from [console.x.ai](https://console.x.ai)

Create a `.env` file in your project root:

```env
GROK_API_KEY=xai-your-api-key-here
```

> Add `.env` to your `.gitignore` to keep your key secure.

### 2. Project Config (turl.json)

A `public/turl.json` file stores your project configuration. It will be **auto-generated** on first run if it doesn't exist.

**Location:** `public/turl.json`

```json
{
  "version": "1.0",
  "projectName": "my-app",
  "branch": "main"
}
```

| Field         | Description                        | Default     |
| ------------- | ---------------------------------- | ----------- |
| `version`     | Current version (auto-incremented) | `"1.0"`     |
| `projectName` | Name used in commit messages       | Folder name |
| `branch`      | Git branch to push to              | `"main"`    |

**Example commit message format:**

```
my-app: Release v1.3

- Added new feature X
- Fixed bug in component Y
```

---

## Usage

### Basic Release

```bash
npx turl-release
```

or

```bash
npm run release
```

### Override Branch

```bash
npx turl-release --branch develop
npx turl-release -b feature/my-branch
```

### Help

```bash
npx turl-release --help
```

---

## What It Does

| Step | Action                                     |
| ---- | ------------------------------------------ |
| 1    | Load API key from `.env`                   |
| 2    | Read config from `public/turl.json`        |
| 3    | Increment version (1.2 -> 1.3, 1.9 -> 2.0) |
| 4    | Remove `console.log()` calls from `src/`   |
| 5    | Remove unused CSS classes from `src/`      |
| 6    | Run code formatter (if available)          |
| 7    | Check for changes (exit if none)           |
| 8    | Update `public/turl.json` with new version |
| 9    | Generate changelog via Grok AI             |
| 10   | Update `CHANGELOG.md`                      |
| 11   | Run production build                       |
| 12   | Stage all changes (`git add -A`)           |
| 13   | Generate commit message via Grok AI        |
| 14   | Commit and push to configured branch       |

---

## Project Structure

Your project needs:

```
my-project/
  ├── .env                 # GROK_API_KEY (required)
  ├── public/
  │   └── turl.json        # Auto-generated config
  ├── src/                 # Source files (cleanup runs here)
  └── package.json
```

---

## Error Handling

The tool includes comprehensive error handling:

| Category  | Errors Caught                                                        |
| --------- | -------------------------------------------------------------------- |
| **Git**   | Not installed, not a repo, no remote, push rejected, auth failures   |
| **API**   | Missing key, invalid key, network errors, rate limits, server errors |
| **Files** | Permission denied, not found, no disk space, invalid JSON            |
| **Build** | Prettier not installed, build failures                               |

**Strict Mode:** If the AI fails, the release stops. No fallback messages.

### Debug Mode

```bash
DEBUG=1 npx turl-release
```

---

## Supported Projects

- Create React App
- Vite + React
- Any React project with `src/` directory

---

## Version Format

```
MAJOR.MINOR

1.0 -> 1.1 -> 1.2 -> ... -> 1.9 -> 2.0
```

---

## Installation Options

### As Dev Dependency (Recommended)

```bash
npm install --save-dev turl-release
```

### Global Link (Development)

```bash
cd /path/to/turl-release
npm link

cd /path/to/your-project
npm link turl-release
```

---

## License

MIT - Free for everyone to use. See [LICENSE.md](LICENSE.md) for details.
