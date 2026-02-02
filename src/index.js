#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { execSync, spawn } from "child_process";
import { run as runCleanup } from "./cleanup.js";

const PROJECT_ROOT = process.cwd();
const args = process.argv.slice(2);

function parseArgs() {
  const options = {
    branch: null,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--branch" || arg === "-b") {
      options.branch = args[i + 1];
      i++;
    } else if (arg.startsWith("--branch=")) {
      options.branch = arg.split("=")[1];
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  return options;
}

function printHelp() {
  process.stdout.write(`
turl-release - Automated semantic versioning and release tool

Usage: turl-release [options]

Options:
  -b, --branch <name>   Override the branch to push to (default: from turl.json or "main")
  -h, --help            Show this help message

Configuration (turl.json):
  {
    "version": "1.0",
    "projectName": "my-project",
    "branch": "main"
  }

`);
}

const ErrorCodes = {
  GIT_NOT_INSTALLED: "GIT_NOT_INSTALLED",
  GIT_NOT_INITIALIZED: "GIT_NOT_INITIALIZED",
  GIT_NO_REMOTE: "GIT_NO_REMOTE",
  GIT_UNCOMMITTED_CHANGES: "GIT_UNCOMMITTED_CHANGES",
  GIT_COMMIT_FAILED: "GIT_COMMIT_FAILED",
  GIT_PUSH_FAILED: "GIT_PUSH_FAILED",
  API_KEY_MISSING: "API_KEY_MISSING",
  API_KEY_INVALID: "API_KEY_INVALID",
  API_NETWORK_ERROR: "API_NETWORK_ERROR",
  API_RATE_LIMITED: "API_RATE_LIMITED",
  API_SERVER_ERROR: "API_SERVER_ERROR",
  API_RESPONSE_INVALID: "API_RESPONSE_INVALID",
  FILE_READ_ERROR: "FILE_READ_ERROR",
  FILE_WRITE_ERROR: "FILE_WRITE_ERROR",
  FILE_PERMISSION_DENIED: "FILE_PERMISSION_DENIED",
  PACKAGE_JSON_MISSING: "PACKAGE_JSON_MISSING",
  PACKAGE_JSON_INVALID: "PACKAGE_JSON_INVALID",
  VERSION_JSON_INVALID: "VERSION_JSON_INVALID",
  BUILD_FAILED: "BUILD_FAILED",
  FORMATTER_FAILED: "FORMATTER_FAILED",
  PRETTIER_NOT_INSTALLED: "PRETTIER_NOT_INSTALLED",
  NODE_MODULES_MISSING: "NODE_MODULES_MISSING",
  ENV_FILE_MISSING: "ENV_FILE_MISSING",
  CLEANUP_FAILED: "CLEANUP_FAILED",
};

class TurlError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = "TurlError";
    this.code = code;
    this.details = details;
  }
}

function checkGitInstalled() {
  try {
    execSync("git --version", { stdio: "pipe" });
    return true;
  } catch {
    throw new TurlError(
      "Git is not installed or not in PATH",
      ErrorCodes.GIT_NOT_INSTALLED,
      { suggestion: "Install git from https://git-scm.com/downloads" },
    );
  }
}

function checkGitRepository() {
  try {
    execSync("git rev-parse --git-dir", { cwd: PROJECT_ROOT, stdio: "pipe" });
    return true;
  } catch {
    throw new TurlError(
      "Not a git repository",
      ErrorCodes.GIT_NOT_INITIALIZED,
      {
        path: PROJECT_ROOT,
        suggestion: "Run 'git init' to initialize a git repository",
      },
    );
  }
}

function checkGitRemote() {
  try {
    const remotes = execSync("git remote", {
      cwd: PROJECT_ROOT,
      encoding: "utf-8",
      stdio: "pipe",
    });
    if (!remotes.trim()) {
      throw new TurlError(
        "No git remote configured",
        ErrorCodes.GIT_NO_REMOTE,
        { suggestion: "Run 'git remote add origin <url>' to add a remote" },
      );
    }
    return true;
  } catch (err) {
    if (err instanceof TurlError) throw err;
    throw new TurlError(
      "Failed to check git remotes",
      ErrorCodes.GIT_NO_REMOTE,
      { originalError: err.message },
    );
  }
}

function checkNodeModules() {
  const nodeModulesPath = path.join(PROJECT_ROOT, "node_modules");
  if (!fs.existsSync(nodeModulesPath)) {
    return {
      exists: false,
      warning:
        "node_modules not found. Run 'npm install' first if you need dependencies.",
    };
  }
  return { exists: true };
}

function checkPrettierInstalled() {
  const nodeModulesPath = path.join(PROJECT_ROOT, "node_modules");
  const prettierPath = path.join(nodeModulesPath, "prettier");
  const globalCheck = () => {
    try {
      execSync("npx prettier --version", { cwd: PROJECT_ROOT, stdio: "pipe" });
      return true;
    } catch {
      return false;
    }
  };

  if (fs.existsSync(prettierPath)) {
    return { installed: true, location: "local" };
  }

  if (globalCheck()) {
    return { installed: true, location: "global" };
  }

  return {
    installed: false,
    warning:
      "Prettier not installed. Install with 'npm install --save-dev prettier' for code formatting.",
  };
}

function safeReadFile(filePath, description = "file") {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch (err) {
    if (err.code === "ENOENT") {
      throw new TurlError(
        `${description} not found: ${filePath}`,
        ErrorCodes.FILE_READ_ERROR,
        { path: filePath },
      );
    }
    if (err.code === "EACCES") {
      throw new TurlError(
        `Permission denied reading ${description}: ${filePath}`,
        ErrorCodes.FILE_PERMISSION_DENIED,
        { path: filePath },
      );
    }
    throw new TurlError(
      `Failed to read ${description}: ${err.message}`,
      ErrorCodes.FILE_READ_ERROR,
      { path: filePath, originalError: err.message },
    );
  }
}

function safeWriteFile(filePath, content, description = "file") {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content, "utf-8");
  } catch (err) {
    if (err.code === "EACCES") {
      throw new TurlError(
        `Permission denied writing ${description}: ${filePath}`,
        ErrorCodes.FILE_PERMISSION_DENIED,
        { path: filePath },
      );
    }
    if (err.code === "ENOSPC") {
      throw new TurlError(
        `No disk space left to write ${description}: ${filePath}`,
        ErrorCodes.FILE_WRITE_ERROR,
        { path: filePath },
      );
    }
    if (err.code === "EROFS") {
      throw new TurlError(
        `Read-only file system, cannot write ${description}: ${filePath}`,
        ErrorCodes.FILE_WRITE_ERROR,
        { path: filePath },
      );
    }
    throw new TurlError(
      `Failed to write ${description}: ${err.message}`,
      ErrorCodes.FILE_WRITE_ERROR,
      { path: filePath, originalError: err.message },
    );
  }
}

function safeParseJson(content, filePath, description = "JSON file") {
  try {
    return JSON.parse(content);
  } catch (err) {
    throw new TurlError(
      `Invalid JSON in ${description}: ${err.message}`,
      ErrorCodes.VERSION_JSON_INVALID,
      { path: filePath, originalError: err.message },
    );
  }
}

function loadEnvFromPath(envPath) {
  if (!fs.existsSync(envPath)) {
    return false;
  }

  const envContent = fs.readFileSync(envPath, "utf-8");
  const lines = envContent.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const equalsIndex = trimmed.indexOf("=");
      if (equalsIndex !== -1) {
        const key = trimmed.substring(0, equalsIndex).trim();
        let value = trimmed.substring(equalsIndex + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (key) {
          process.env[key] = value;
        }
      }
    }
  }

  return true;
}

function loadEnv() {
  const projectEnvPath = path.join(PROJECT_ROOT, ".env");
  const projectEnvLoaded = loadEnvFromPath(projectEnvPath);

  if (
    projectEnvLoaded &&
    (process.env.GROK_API_KEY || process.env.REACT_APP_GROK_API_KEY)
  ) {
    return "project";
  }

  return null;
}

function getApiKey() {
  return process.env.GROK_API_KEY || process.env.REACT_APP_GROK_API_KEY || null;
}

function validateApiKey(apiKey) {
  if (!apiKey) {
    throw new TurlError(
      "No GROK_API_KEY found in project .env file",
      ErrorCodes.API_KEY_MISSING,
      {
        suggestion: "Add GROK_API_KEY=your-key to your project's .env file",
        helpUrl: "https://console.x.ai",
      },
    );
  }

  if (!apiKey.startsWith("xai-") && !apiKey.startsWith("sk-")) {
    throw new TurlError(
      "Invalid API key format. Key should start with 'xai-' or 'sk-'",
      ErrorCodes.API_KEY_INVALID,
      {
        suggestion: "Check your API key at https://console.x.ai",
        keyPrefix: apiKey.substring(0, 4) + "...",
      },
    );
  }

  if (apiKey.length < 20) {
    throw new TurlError(
      "API key appears to be too short",
      ErrorCodes.API_KEY_INVALID,
      { suggestion: "Verify your API key at https://console.x.ai" },
    );
  }

  return true;
}

function readTurlConfig() {
  const turlPath = path.join(PROJECT_ROOT, "public", "turl.json");

  const defaultConfig = {
    version: "1.0",
    projectName: path.basename(PROJECT_ROOT),
    branch: "main",
  };

  if (!fs.existsSync(turlPath)) {
    const publicDir = path.join(PROJECT_ROOT, "public");
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    safeWriteFile(
      turlPath,
      JSON.stringify(defaultConfig, null, 2),
      "turl.json",
    );
    return defaultConfig;
  }

  const content = safeReadFile(turlPath, "turl.json");
  const parsed = safeParseJson(content, turlPath, "turl.json");

  return {
    version: String(parsed.version || defaultConfig.version),
    projectName: parsed.projectName || defaultConfig.projectName,
    branch: parsed.branch || defaultConfig.branch,
  };
}

function incrementVersion(version) {
  const parts = version.split(".");
  let major = parseInt(parts[0], 10) || 1;
  let minor = parseInt(parts[1], 10) || 0;

  minor++;
  if (minor >= 10) {
    major++;
    minor = 0;
  }

  return `${major}.${minor}`;
}

function writeTurlConfig(config) {
  const turlPath = path.join(PROJECT_ROOT, "public", "turl.json");
  safeWriteFile(turlPath, JSON.stringify(config, null, 2) + "\n", "turl.json");
}

function execCommand(command, options = {}) {
  try {
    return execSync(command, {
      cwd: PROJECT_ROOT,
      encoding: "utf-8",
      stdio: options.silent ? "pipe" : "inherit",
      ...options,
    });
  } catch (err) {
    if (options.ignoreError) {
      return err.stdout || "";
    }
    throw err;
  }
}

function execCommandSilent(command) {
  try {
    return execSync(command, {
      cwd: PROJECT_ROOT,
      encoding: "utf-8",
      stdio: "pipe",
    });
  } catch (err) {
    return err.stdout || err.stderr || "";
  }
}

function hasChanges() {
  const status = execCommandSilent("git status --porcelain");
  return status.trim().length > 0;
}

function getGitDiff() {
  const diff = execCommandSilent("git diff HEAD");
  const stagedDiff = execCommandSilent("git diff --cached");
  return diff + stagedDiff;
}

function getGitDiffStat() {
  const stat = execCommandSilent("git diff HEAD --stat");
  const stagedStat = execCommandSilent("git diff --cached --stat");
  return stat + stagedStat;
}

function getChangedFiles() {
  const files = execCommandSilent("git diff HEAD --name-only");
  const stagedFiles = execCommandSilent("git diff --cached --name-only");
  const combined = files + stagedFiles;
  return [...new Set(combined.split("\n").filter(Boolean))];
}

async function callGrokApi(apiKey, prompt) {
  let response;

  try {
    response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-3-latest",
        messages: [
          {
            role: "system",
            content:
              "You are a precise technical assistant that generates changelog entries and commit messages. You ONLY describe changes that are explicitly visible in the provided diff. Never invent or assume changes. Be specific and accurate.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 1000,
      }),
    });
  } catch (err) {
    if (err.code === "ENOTFOUND" || err.code === "EAI_AGAIN") {
      throw new TurlError(
        "Network error: Unable to reach Grok API. Check your internet connection.",
        ErrorCodes.API_NETWORK_ERROR,
        { originalError: err.message },
      );
    }
    if (err.code === "ETIMEDOUT" || err.code === "ESOCKETTIMEDOUT") {
      throw new TurlError(
        "Network timeout: Grok API request timed out. Try again later.",
        ErrorCodes.API_NETWORK_ERROR,
        { originalError: err.message },
      );
    }
    if (err.code === "ECONNREFUSED") {
      throw new TurlError(
        "Connection refused: Unable to connect to Grok API.",
        ErrorCodes.API_NETWORK_ERROR,
        { originalError: err.message },
      );
    }
    throw new TurlError(
      `Network error calling Grok API: ${err.message}`,
      ErrorCodes.API_NETWORK_ERROR,
      { originalError: err.message },
    );
  }

  if (!response.ok) {
    const errorText = await response.text();
    let errorData;
    try {
      errorData = JSON.parse(errorText);
    } catch {
      errorData = { error: errorText };
    }

    if (response.status === 401 || response.status === 400) {
      if (
        errorText.includes("invalid argument") ||
        errorText.includes("Invalid API key") ||
        errorText.includes("Incorrect API key")
      ) {
        throw new TurlError(
          "Invalid API key. Please check your GROK_API_KEY in .env file.",
          ErrorCodes.API_KEY_INVALID,
          {
            status: response.status,
            suggestion: "Get a valid API key from https://console.x.ai",
            response: errorData,
          },
        );
      }
    }

    if (response.status === 429) {
      throw new TurlError(
        "Rate limited by Grok API. Please wait and try again.",
        ErrorCodes.API_RATE_LIMITED,
        {
          status: response.status,
          suggestion: "Wait a few minutes before trying again",
          response: errorData,
        },
      );
    }

    if (response.status >= 500) {
      throw new TurlError(
        "Grok API server error. The service may be temporarily unavailable.",
        ErrorCodes.API_SERVER_ERROR,
        {
          status: response.status,
          suggestion: "Try again in a few minutes",
          response: errorData,
        },
      );
    }

    throw new TurlError(
      `Grok API error: ${response.status} - ${errorText}`,
      ErrorCodes.API_SERVER_ERROR,
      { status: response.status, response: errorData },
    );
  }

  let data;
  try {
    data = await response.json();
  } catch (err) {
    throw new TurlError(
      "Invalid JSON response from Grok API",
      ErrorCodes.API_RESPONSE_INVALID,
      { originalError: err.message },
    );
  }

  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    throw new TurlError(
      "Unexpected response format from Grok API",
      ErrorCodes.API_RESPONSE_INVALID,
      { response: data },
    );
  }

  return data.choices[0].message.content || "";
}

async function generateChangelog(
  apiKey,
  newVersion,
  projectName,
  diff,
  stat,
  changedFiles,
) {
  const today = new Date().toISOString().split("T")[0];

  if (!diff.trim()) {
    throw new TurlError(
      "No diff available to generate changelog",
      ErrorCodes.API_RESPONSE_INVALID,
      { suggestion: "Make sure there are actual code changes to release" },
    );
  }

  const truncatedDiff =
    diff.length > 8000 ? diff.substring(0, 8000) + "\n... (truncated)" : diff;

  const prompt = `Generate a changelog entry for ${projectName} version ${newVersion}.

RULES:
1. ONLY list changes that are EXPLICITLY visible in the diff below
2. Do NOT invent or assume any changes not shown in the diff
3. Be specific and accurate - mention actual file names, function names, or features changed
4. Group related changes together
5. Use bullet points starting with "-"
6. Include ALL meaningful changes visible in the diff - there is no strict bullet limit
7. Aim for brevity while ensuring completeness
8. Do NOT use any emojis
9. Do NOT include "Version bump" unless there are no other changes

Changed files: ${changedFiles.join(", ")}

Diff statistics:
${stat}

Actual diff:
${truncatedDiff}

Output format (EXACTLY):
## [${newVersion}] - ${today}

- First change
- Second change
- (as many as needed for all meaningful changes)`;

  const response = await callGrokApi(apiKey, prompt);

  if (!response || !response.includes(`## [${newVersion}]`)) {
    throw new TurlError(
      "Grok API returned invalid changelog format",
      ErrorCodes.API_RESPONSE_INVALID,
      {
        response: response ? response.substring(0, 200) : "empty",
        suggestion: "The AI response did not match expected format",
      },
    );
  }

  return response.trim() + "\n";
}

async function generateCommitMessage(
  apiKey,
  newVersion,
  projectName,
  diff,
  stat,
  changedFiles,
) {
  const firstLine = `${projectName}: Release v${newVersion}`;

  if (!diff.trim()) {
    throw new TurlError(
      "No diff available to generate commit message",
      ErrorCodes.API_RESPONSE_INVALID,
      { suggestion: "Make sure there are actual code changes to commit" },
    );
  }

  const truncatedDiff =
    diff.length > 8000 ? diff.substring(0, 8000) + "\n... (truncated)" : diff;

  const prompt = `Generate a git commit message for ${projectName} version ${newVersion}.

CRITICAL RULES:
1. The FIRST line MUST be EXACTLY: "${projectName}: Release v${newVersion}"
2. The SECOND line MUST be blank
3. Then bullet points of changes starting with "-"
4. ONLY list changes that are EXPLICITLY visible in the diff below
5. Do NOT invent or assume any changes not shown in the diff
6. Be specific and accurate
7. Group related changes together
8. Include ALL meaningful changes visible in the diff - no strict bullet limit
9. Aim for brevity while ensuring completeness
10. Do NOT use any emojis

Changed files: ${changedFiles.join(", ")}

Diff statistics:
${stat}

Actual diff:
${truncatedDiff}

Output format (EXACTLY):
${projectName}: Release v${newVersion}

- First change
- Second change
- (as many as needed)`;

  const response = await callGrokApi(apiKey, prompt);

  if (!response) {
    throw new TurlError(
      "Grok API returned empty commit message",
      ErrorCodes.API_RESPONSE_INVALID,
      { suggestion: "The AI did not generate a valid response" },
    );
  }

  if (response.startsWith(`${projectName}: Release v${newVersion}`)) {
    return response.trim();
  }

  if (response.includes("-")) {
    return `${firstLine}\n\n${response.trim()}`;
  }

  throw new TurlError(
    "Grok API returned invalid commit message format",
    ErrorCodes.API_RESPONSE_INVALID,
    {
      response: response.substring(0, 200),
      suggestion: "The AI response did not match expected format",
    },
  );
}

function updateChangelog(changelogEntry) {
  const changelogPath = path.join(PROJECT_ROOT, "CHANGELOG.md");
  let existingContent = "";

  if (fs.existsSync(changelogPath)) {
    existingContent = safeReadFile(changelogPath, "CHANGELOG.md");
  }

  const header =
    "# Changelog\n\nAll notable changes to this project will be documented in this file.\n\n";

  if (!existingContent) {
    safeWriteFile(
      changelogPath,
      header + changelogEntry + "\n",
      "CHANGELOG.md",
    );
    return;
  }

  if (existingContent.startsWith("# Changelog")) {
    const headerEndIndex = existingContent.indexOf(
      "\n\n",
      existingContent.indexOf("\n") + 1,
    );
    if (headerEndIndex !== -1) {
      const existingHeader = existingContent.substring(0, headerEndIndex + 2);
      const existingEntries = existingContent.substring(headerEndIndex + 2);
      safeWriteFile(
        changelogPath,
        existingHeader + changelogEntry + "\n" + existingEntries,
        "CHANGELOG.md",
      );
      return;
    }
  }

  safeWriteFile(
    changelogPath,
    header + changelogEntry + "\n" + existingContent,
    "CHANGELOG.md",
  );
}

function detectBuildCommand() {
  const packageJsonPath = path.join(PROJECT_ROOT, "package.json");

  if (!fs.existsSync(packageJsonPath)) {
    return null;
  }

  const content = safeReadFile(packageJsonPath, "package.json");
  const packageJson = safeParseJson(content, packageJsonPath, "package.json");
  const scripts = packageJson.scripts || {};

  if (scripts.build) {
    return "npm run build";
  }

  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

  if (deps.vite) {
    return "npx vite build";
  }

  if (deps["react-scripts"]) {
    return "npx react-scripts build";
  }

  return null;
}

function detectFormatCommand() {
  const packageJsonPath = path.join(PROJECT_ROOT, "package.json");

  if (!fs.existsSync(packageJsonPath)) {
    return { command: null, warning: "No package.json found" };
  }

  const content = safeReadFile(packageJsonPath, "package.json");
  const packageJson = safeParseJson(content, packageJsonPath, "package.json");
  const scripts = packageJson.scripts || {};

  if (scripts.format) {
    return { command: "npm run format", type: "script" };
  }

  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  const prettierCheck = checkPrettierInstalled();

  if (deps.prettier || prettierCheck.installed) {
    return { command: "npx prettier --write .", type: "prettier" };
  }

  return {
    command: null,
    warning: prettierCheck.warning || "No formatter configured",
    suggestion:
      "Add prettier as dev dependency or add a 'format' script to package.json",
  };
}

function runBuild(buildCommand) {
  return new Promise((resolve, reject) => {
    const [cmd, ...args] = buildCommand.split(" ");
    const child = spawn(cmd, args, {
      cwd: PROJECT_ROOT,
      stdio: "inherit",
      shell: true,
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new TurlError(
            `Build failed with exit code ${code}`,
            ErrorCodes.BUILD_FAILED,
            { command: buildCommand, exitCode: code },
          ),
        );
      }
    });

    child.on("error", (err) => {
      reject(
        new TurlError(
          `Build process error: ${err.message}`,
          ErrorCodes.BUILD_FAILED,
          { command: buildCommand, originalError: err.message },
        ),
      );
    });
  });
}

function gitCommit(commitMessage) {
  const tempFile = path.join(PROJECT_ROOT, ".commit-msg-temp");

  try {
    safeWriteFile(tempFile, commitMessage, "commit message temp file");
    execCommand(`git commit -F "${tempFile}"`, { silent: true });

    try {
      fs.unlinkSync(tempFile);
    } catch {}
  } catch (err) {
    try {
      fs.unlinkSync(tempFile);
    } catch {}

    if (err.message && err.message.includes("nothing to commit")) {
      throw new TurlError(
        "Nothing to commit - all changes may have been reverted",
        ErrorCodes.GIT_COMMIT_FAILED,
        { suggestion: "Make sure there are actual changes to commit" },
      );
    }

    throw new TurlError(
      `Git commit failed: ${err.message}`,
      ErrorCodes.GIT_COMMIT_FAILED,
      { originalError: err.message },
    );
  }
}

function gitPush(branch = "main") {
  try {
    execCommand(`git push origin ${branch}`, { silent: true });
  } catch (err) {
    const errorMsg = err.message || err.stderr || "";

    if (
      errorMsg.includes("rejected") ||
      errorMsg.includes("non-fast-forward")
    ) {
      throw new TurlError(
        `Push rejected. Remote has changes not present locally.`,
        ErrorCodes.GIT_PUSH_FAILED,
        {
          branch,
          suggestion:
            "Pull the latest changes with 'git pull origin " +
            branch +
            "' and try again",
        },
      );
    }

    if (
      errorMsg.includes("Permission denied") ||
      errorMsg.includes("authentication")
    ) {
      throw new TurlError(
        "Git push failed: Authentication error",
        ErrorCodes.GIT_PUSH_FAILED,
        {
          branch,
          suggestion: "Check your git credentials or SSH keys",
        },
      );
    }

    if (
      errorMsg.includes("does not exist") ||
      errorMsg.includes("Could not read from remote")
    ) {
      throw new TurlError(
        "Git push failed: Remote repository not found",
        ErrorCodes.GIT_PUSH_FAILED,
        {
          branch,
          suggestion: "Check your remote URL with 'git remote -v'",
        },
      );
    }

    throw new TurlError(
      `Git push failed: ${errorMsg}`,
      ErrorCodes.GIT_PUSH_FAILED,
      { branch, originalError: errorMsg },
    );
  }
}

function printError(err) {
  process.stdout.write(`\n  ERROR: ${err.message}\n`);

  if (err.details) {
    if (err.details.suggestion) {
      process.stdout.write(`  SUGGESTION: ${err.details.suggestion}\n`);
    }
    if (err.details.helpUrl) {
      process.stdout.write(`  MORE INFO: ${err.details.helpUrl}\n`);
    }
  }
}

async function main() {
  const cliOptions = parseArgs();

  process.stdout.write("\n========================================\n");
  process.stdout.write("       TURL-RELEASE v1.0.0\n");
  process.stdout.write("========================================\n\n");

  process.stdout.write("[0/12] Pre-flight checks...\n");

  try {
    checkGitInstalled();
    process.stdout.write("  [OK] Git is installed\n");
  } catch (err) {
    printError(err);
    process.exit(1);
  }

  try {
    checkGitRepository();
    process.stdout.write("  [OK] Git repository initialized\n");
  } catch (err) {
    printError(err);
    process.exit(1);
  }

  try {
    checkGitRemote();
    process.stdout.write("  [OK] Git remote configured\n");
  } catch (err) {
    printError(err);
    process.exit(1);
  }

  const nodeModulesCheck = checkNodeModules();
  if (!nodeModulesCheck.exists) {
    process.stdout.write(`  [WARN] ${nodeModulesCheck.warning}\n`);
  } else {
    process.stdout.write("  [OK] node_modules found\n");
  }

  process.stdout.write("\n[1/12] Loading environment variables...\n");
  loadEnv();
  const apiKey = getApiKey();

  try {
    validateApiKey(apiKey);
    process.stdout.write("  [OK] API key loaded and validated\n");
  } catch (err) {
    printError(err);
    process.exit(1);
  }

  process.stdout.write("\n[2/12] Reading turl.json config...\n");
  let turlConfig;
  try {
    turlConfig = readTurlConfig();
    process.stdout.write(`  Project: ${turlConfig.projectName}\n`);
    process.stdout.write(`  Current version: ${turlConfig.version}\n`);
    process.stdout.write(
      `  Branch: ${cliOptions.branch || turlConfig.branch}\n`,
    );
  } catch (err) {
    printError(err);
    process.exit(1);
  }

  const currentVersion = turlConfig.version;
  const projectName = turlConfig.projectName;
  const branch = cliOptions.branch || turlConfig.branch;

  process.stdout.write("\n[3/12] Calculating new version...\n");
  const newVersion = incrementVersion(currentVersion);
  process.stdout.write(`  New version: ${newVersion}\n`);

  process.stdout.write("\n[4/12] Running code cleanup...\n");
  try {
    const cleanupStats = await runCleanup(PROJECT_ROOT);
    process.stdout.write(
      `  Removed ${cleanupStats.consoleLogsRemoved} console.log calls\n`,
    );
    process.stdout.write(
      `  Removed ${cleanupStats.cssClassesRemoved} unused CSS classes\n`,
    );

    if (cleanupStats.errors && cleanupStats.errors.length > 0) {
      process.stdout.write(
        `  [WARN] ${cleanupStats.errors.length} cleanup errors (non-fatal)\n`,
      );
      for (const error of cleanupStats.errors.slice(0, 3)) {
        process.stdout.write(`    - ${error.message}\n`);
      }
    }

    if (cleanupStats.warnings && cleanupStats.warnings.length > 0) {
      process.stdout.write(
        `  [WARN] ${cleanupStats.warnings.length} cleanup warnings\n`,
      );
    }
  } catch (err) {
    process.stdout.write(
      `  [WARN] Cleanup error (non-fatal): ${err.message}\n`,
    );
  }

  process.stdout.write("\n[5/12] Running code formatter...\n");
  const formatResult = detectFormatCommand();

  if (formatResult.command) {
    try {
      execCommand(formatResult.command, { silent: true, ignoreError: false });
      process.stdout.write(`  [OK] Formatted with: ${formatResult.command}\n`);
    } catch (err) {
      const errorMsg = err.message || "";

      if (
        errorMsg.includes("ENOENT") ||
        errorMsg.includes("not found") ||
        errorMsg.includes("command not found")
      ) {
        if (formatResult.type === "prettier") {
          process.stdout.write(
            "  [WARN] Prettier not found. Install with: npm install --save-dev prettier\n",
          );
        } else {
          process.stdout.write(
            `  [WARN] Format command not available: ${formatResult.command}\n`,
          );
        }
      } else if (errorMsg.includes("EACCES")) {
        process.stdout.write("  [WARN] Permission denied running formatter\n");
      } else {
        process.stdout.write(`  [WARN] Format failed: ${err.message}\n`);
      }
      process.stdout.write("  Continuing without formatting...\n");
    }
  } else {
    process.stdout.write(
      `  [SKIP] ${formatResult.warning || "No formatter detected"}\n`,
    );
    if (formatResult.suggestion) {
      process.stdout.write(`  TIP: ${formatResult.suggestion}\n`);
    }
  }

  process.stdout.write("\n[6/12] Checking for changes...\n");
  const diff = getGitDiff();
  const stat = getGitDiffStat();
  const changedFiles = getChangedFiles();

  if (!hasChanges() && !diff.trim()) {
    process.stdout.write("  No changes detected. Nothing to release.\n");
    process.stdout.write("\n========================================\n");
    process.stdout.write("  Release skipped - no changes\n");
    process.stdout.write("========================================\n\n");
    process.exit(0);
  }
  process.stdout.write(`  Found ${changedFiles.length} changed files\n`);

  process.stdout.write("\n[7/12] Updating turl.json...\n");
  try {
    const updatedConfig = {
      version: newVersion,
      projectName: projectName,
      branch: turlConfig.branch,
    };
    writeTurlConfig(updatedConfig);
    process.stdout.write(`  Updated to version ${newVersion}\n`);
  } catch (err) {
    printError(err);
    process.exit(1);
  }

  process.stdout.write("\n[8/12] Generating changelog...\n");
  let changelogEntry;
  try {
    changelogEntry = await generateChangelog(
      apiKey,
      newVersion,
      projectName,
      diff,
      stat,
      changedFiles,
    );
    process.stdout.write("  [OK] Changelog generated with AI\n");
  } catch (err) {
    printError(err);
    process.exit(1);
  }

  process.stdout.write("\n[9/12] Updating CHANGELOG.md...\n");
  try {
    updateChangelog(changelogEntry);
    process.stdout.write("  [OK] CHANGELOG.md updated\n");
  } catch (err) {
    printError(err);
    process.exit(1);
  }

  process.stdout.write("\n[10/12] Running production build...\n");
  const buildCommand = detectBuildCommand();
  if (buildCommand) {
    try {
      await runBuild(buildCommand);
      process.stdout.write("  [OK] Build completed successfully\n");
    } catch (err) {
      process.stdout.write(`  [WARN] Build failed: ${err.message}\n`);
      if (err.details && err.details.suggestion) {
        process.stdout.write(`  TIP: ${err.details.suggestion}\n`);
      }
      process.stdout.write("  Continuing with release...\n");
    }
  } else {
    process.stdout.write("  [SKIP] No build command detected\n");
  }

  process.stdout.write("\n[11/12] Staging all changes...\n");
  try {
    execCommand("git add -A", { silent: true });
    process.stdout.write("  [OK] All changes staged\n");
  } catch (err) {
    process.stdout.write(`  [ERROR] Failed to stage changes: ${err.message}\n`);
    process.exit(1);
  }

  const finalDiff = getGitDiff();
  const finalStat = getGitDiffStat();
  const finalChangedFiles = getChangedFiles();

  process.stdout.write("\n[12/12] Committing and pushing...\n");
  process.stdout.write("  Generating commit message with AI...\n");

  let commitMessage;
  try {
    commitMessage = await generateCommitMessage(
      apiKey,
      newVersion,
      projectName,
      finalDiff,
      finalStat,
      finalChangedFiles,
    );
    process.stdout.write("  [OK] Commit message generated\n");
  } catch (err) {
    printError(err);
    process.exit(1);
  }

  try {
    gitCommit(commitMessage);
    process.stdout.write("  [OK] Committed successfully\n");
  } catch (err) {
    printError(err);
    process.exit(1);
  }

  process.stdout.write(`  Pushing to origin/${branch}...\n`);
  try {
    gitPush(branch);
    process.stdout.write("  [OK] Pushed successfully\n");
  } catch (err) {
    printError(err);
    process.exit(1);
  }

  process.stdout.write("\n========================================\n");
  process.stdout.write(`  ${projectName} v${newVersion} released!\n`);
  process.stdout.write("========================================\n\n");
}

main().catch((err) => {
  if (err instanceof TurlError) {
    process.stdout.write(`\nRelease failed: ${err.message}\n`);
    if (err.details && err.details.suggestion) {
      process.stdout.write(`Suggestion: ${err.details.suggestion}\n`);
    }
    if (err.code) {
      process.stdout.write(`Error code: ${err.code}\n`);
    }
  } else {
    process.stdout.write(`\nRelease failed: ${err.message}\n`);
    if (err.stack && process.env.DEBUG) {
      process.stdout.write(`Stack trace:\n${err.stack}\n`);
    }
  }
  process.exit(1);
});
