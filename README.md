# turl-release

Automated semantic versioning, cleanup, changelog generation, and release commits for React projects.

by Trent

---

## Table of Contents

- [Installation](#installation)
- [Setup](#setup)
- [Usage](#usage)
- [Configuration](#configuration)
- [What It Does](#what-it-does)
- [Error Handling](#error-handling)
- [Supported Projects](#supported-projects)
- [License](#license)

---

## Installation

```bash
npm install --save-dev turl-release
```

Add to your `package.json` scripts:

```json
{
  "scripts": {
    "release": "turl-release"
  }
}
```

---

## Setup

### Step 1: Create `.env` file

Create a `.env` file in your project root with your Grok API key:

```env
GROK_API_KEY=xai-your-api-key-here
```

Get your API key from [console.x.ai](https://console.x.ai)

Add `.env` to your `.gitignore`:

```
.env
```

### Step 2: Create `turl.json` (Optional)

The tool auto-generates `public/turl.json` on first run, but you can create it manually:

```json
{
  "version": "1.0",
  "projectName": "my-app",
  "branch": "main"
}
```

---

## Configuration

### turl.json

Location: `public/turl.json`

```json
{
  "version": "1.0",
  "projectName": "my-app",
  "branch": "main"
}
```

| Field         | Type     | Description                        | Default     |
| ------------- | -------- | ---------------------------------- | ----------- |
| `version`     | `string` | Current version (auto-incremented) | `"1.0"`     |
| `projectName` | `string` | Name used in commit messages       | Folder name |
| `branch`      | `string` | Git branch to push to              | `"main"`    |

### API Key

The API key must be set in each project that uses turl-release.

Supported environment variable names (checked in order):

1. `GROK_API_KEY`
2. `REACT_APP_GROK_API_KEY`

---

## Usage

### Basic Release

```bash
npm run release
```

or

```bash
npx turl-release
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

### Debug Mode

```bash
DEBUG=1 npx turl-release
```

---

## What It Does

| Step | Action                                        |
| ---- | --------------------------------------------- |
| 0    | Pre-flight checks (git, remote, node_modules) |
| 1    | Load API key from project `.env`              |
| 2    | Read config from `public/turl.json`           |
| 3    | Increment version (1.2 -> 1.3, 1.9 -> 2.0)    |
| 4    | Remove `console.log()` calls from `src/`      |
| 5    | Remove unused CSS classes from `src/`         |
| 6    | Run code formatter (if available)             |
| 7    | Check for changes (exit if none)              |
| 8    | Update `public/turl.json` with new version    |
| 9    | Generate changelog via Grok AI                |
| 10   | Update `CHANGELOG.md`                         |
| 11   | Run production build                          |
| 12   | Stage, commit, and push                       |

### Version Rollback

If any step fails after the version is updated, the tool automatically rolls back `turl.json` to the original version.

### Commit Message Format

```
my-app: Release v1.3

- Added new feature X
- Fixed bug in component Y
- Updated styling for component Z
```

---

## Project Structure

Your project needs:

```
my-project/
  .env                    <- GROK_API_KEY (required)
  public/
    turl.json             <- Auto-generated config
  src/                    <- Source files (cleanup runs here)
  package.json
```

---

## Error Handling

The tool includes comprehensive error handling for common issues:

| Category | Errors Handled                                                     |
| -------- | ------------------------------------------------------------------ |
| Git      | Not installed, not a repo, no remote, push rejected, auth failures |
| API      | Missing key, invalid key, network errors, rate limits              |
| Files    | Permission denied, not found, no disk space, invalid JSON          |
| Build    | Prettier not installed, build command failures                     |
| Cleanup  | Directory access, file read/write errors                           |

### Strict Mode

If the AI fails to generate a changelog or commit message, the release stops. No fallback messages are used.

---

## Supported Projects

- Create React App
- Vite + React
- Any React project with a `src/` directory

---

## Version Format

```
MAJOR.MINOR

1.0 -> 1.1 -> 1.2 -> ... -> 1.9 -> 2.0 -> 2.1 -> ...
```

---

## Development

### Global Link

```bash
cd /path/to/turl-release
npm link

cd /path/to/your-project
npm link turl-release
```

---

## License

MIT - Free for everyone to use. See [LICENSE.md](LICENSE.md) for details.
