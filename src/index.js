#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { execSync, spawn } from "child_process";
import { fileURLToPath } from "url";
import { run as runCleanup } from "./cleanup.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACKAGE_ROOT = path.resolve(__dirname, "..");
const PROJECT_ROOT = process.cwd();

function loadEnvFromPath(envPath) {
  if (!fs.existsSync(envPath)) {
    return false;
  }

  const envContent = fs.readFileSync(envPath, "utf-8");
  const lines = envContent.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...valueParts] = trimmed.split("=");
      if (key && valueParts.length > 0) {
        process.env[key.trim()] = valueParts.join("=").trim();
      }
    }
  }

  return true;
}

function loadEnv() {
  const isSelfProject = PACKAGE_ROOT === PROJECT_ROOT;

  const projectEnvPath = path.join(PROJECT_ROOT, ".env");
  const projectEnvLoaded = loadEnvFromPath(projectEnvPath);

  if (projectEnvLoaded && process.env.GROK_API_KEY) {
    return isSelfProject ? "local" : "project";
  }

  if (!isSelfProject) {
    const packageEnvPath = path.join(PACKAGE_ROOT, ".env");
    const packageEnvLoaded = loadEnvFromPath(packageEnvPath);

    if (packageEnvLoaded && process.env.GROK_API_KEY) {
      return "package";
    }
  }

  return null;
}

function getApiKey() {
  return process.env.GROK_API_KEY || process.env.REACT_APP_GROK_API_KEY || null;
}

function readVersionJson() {
  const versionPath = path.join(PROJECT_ROOT, "public", "version.json");

  if (!fs.existsSync(versionPath)) {
    const publicDir = path.join(PROJECT_ROOT, "public");
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    fs.writeFileSync(versionPath, JSON.stringify({ version: "1.0" }, null, 2), "utf-8");
    return "1.0";
  }

  const content = JSON.parse(fs.readFileSync(versionPath, "utf-8"));
  return content.version || "1.0";
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

function writeVersionJson(version) {
  const versionPath = path.join(PROJECT_ROOT, "public", "version.json");
  fs.writeFileSync(versionPath, JSON.stringify({ version }, null, 2) + "\n", "utf-8");
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
  const response = await fetch("https://api.x.ai/v1/chat/completions", {
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
          content: "You are a precise technical assistant that generates changelog entries and commit messages. You ONLY describe changes that are explicitly visible in the provided diff. Never invent or assume changes. Be specific and accurate.",
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

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Grok API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || "";
}

async function generateChangelog(apiKey, newVersion, diff, stat, changedFiles) {
  const today = new Date().toISOString().split("T")[0];

  if (!diff.trim()) {
    throw new Error("No diff available to generate changelog");
  }

  const truncatedDiff = diff.length > 8000 ? diff.substring(0, 8000) + "\n... (truncated)" : diff;

  const prompt = `Generate a changelog entry for version ${newVersion}.

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
  if (response && response.includes(`## [${newVersion}]`)) {
    return response.trim() + "\n";
  }
  throw new Error("Grok API returned invalid changelog format");
}

async function generateCommitMessage(apiKey, newVersion, diff, stat, changedFiles) {
  const firstLine = `Release: v${newVersion}`;

  if (!diff.trim()) {
    throw new Error("No diff available to generate commit message");
  }

  const truncatedDiff = diff.length > 8000 ? diff.substring(0, 8000) + "\n... (truncated)" : diff;

  const prompt = `Generate a git commit message for version ${newVersion}.

CRITICAL RULES:
1. The FIRST line MUST be EXACTLY: "Release: v${newVersion}"
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
Release: v${newVersion}

- First change
- Second change
- (as many as needed)`;

  const response = await callGrokApi(apiKey, prompt);
  if (response && response.startsWith(`Release: v${newVersion}`)) {
    return response.trim();
  }
  if (response && response.includes("-")) {
    return `${firstLine}\n\n${response.trim()}`;
  }
  throw new Error("Grok API returned invalid commit message format");
}

function updateChangelog(changelogEntry) {
  const changelogPath = path.join(PROJECT_ROOT, "CHANGELOG.md");
  let existingContent = "";

  if (fs.existsSync(changelogPath)) {
    existingContent = fs.readFileSync(changelogPath, "utf-8");
  }

  const header = "# Changelog\n\nAll notable changes to this project will be documented in this file.\n\n";

  if (!existingContent) {
    fs.writeFileSync(changelogPath, header + changelogEntry + "\n", "utf-8");
    return;
  }

  if (existingContent.startsWith("# Changelog")) {
    const headerEndIndex = existingContent.indexOf("\n\n", existingContent.indexOf("\n") + 1);
    if (headerEndIndex !== -1) {
      const existingHeader = existingContent.substring(0, headerEndIndex + 2);
      const existingEntries = existingContent.substring(headerEndIndex + 2);
      fs.writeFileSync(changelogPath, existingHeader + changelogEntry + "\n" + existingEntries, "utf-8");
      return;
    }
  }

  fs.writeFileSync(changelogPath, header + changelogEntry + "\n" + existingContent, "utf-8");
}

function detectBuildCommand() {
  const packageJsonPath = path.join(PROJECT_ROOT, "package.json");

  if (!fs.existsSync(packageJsonPath)) {
    return null;
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
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
    return null;
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
  const scripts = packageJson.scripts || {};

  if (scripts.format) {
    return "npm run format";
  }

  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

  if (deps.prettier) {
    return "npx prettier --write .";
  }

  return null;
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
        reject(new Error(`Build failed with exit code ${code}`));
      }
    });

    child.on("error", reject);
  });
}

async function main() {
  process.stdout.write("\n========================================\n");
  process.stdout.write("       TURL-RELEASE v1.0.0\n");
  process.stdout.write("========================================\n\n");

  process.stdout.write("[1/12] Loading environment variables...\n");
  const envSource = loadEnv();
  const apiKey = getApiKey();
  if (!apiKey) {
    process.stdout.write("  ERROR: No GROK_API_KEY found\n");
    process.stdout.write("  Add GROK_API_KEY=your-key to your project's .env file\n");
    process.stdout.write("  Get your API key from https://console.x.ai\n");
    process.exit(1);
  }
  const sourceMessages = {
    local: "from local .env",
    package: "from turl-release package",
    project: "from project .env"
  };
  process.stdout.write(`  API key loaded successfully (${sourceMessages[envSource] || "unknown source"})\n`);

  process.stdout.write("\n[2/12] Reading current version...\n");
  const currentVersion = readVersionJson();
  process.stdout.write(`  Current version: ${currentVersion}\n`);

  process.stdout.write("\n[3/12] Calculating new version...\n");
  const newVersion = incrementVersion(currentVersion);
  process.stdout.write(`  New version: ${newVersion}\n`);

  process.stdout.write("\n[4/12] Running code cleanup...\n");
  try {
    const cleanupStats = await runCleanup(PROJECT_ROOT);
    process.stdout.write(`  Removed ${cleanupStats.consoleLogsRemoved} console.log calls\n`);
    process.stdout.write(`  Removed ${cleanupStats.cssClassesRemoved} unused CSS classes\n`);
  } catch (err) {
    process.stdout.write(`  Cleanup error: ${err.message}\n`);
  }

  process.stdout.write("\n[5/12] Running code formatter...\n");
  const formatCommand = detectFormatCommand();
  if (formatCommand) {
    try {
      execCommand(formatCommand, { silent: true, ignoreError: true });
      process.stdout.write(`  Formatted with: ${formatCommand}\n`);
    } catch {
      process.stdout.write("  Format command failed, continuing...\n");
    }
  } else {
    process.stdout.write("  No formatter detected, skipping...\n");
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

  process.stdout.write("\n[7/12] Updating version.json...\n");
  writeVersionJson(newVersion);
  process.stdout.write(`  Updated to version ${newVersion}\n`);

  process.stdout.write("\n[8/12] Generating changelog...\n");
  const changelogEntry = await generateChangelog(apiKey, newVersion, diff, stat, changedFiles);
  process.stdout.write("  Changelog generated with AI\n");

  process.stdout.write("\n[9/12] Updating CHANGELOG.md...\n");
  updateChangelog(changelogEntry);
  process.stdout.write("  CHANGELOG.md updated\n");

  process.stdout.write("\n[10/12] Running production build...\n");
  const buildCommand = detectBuildCommand();
  if (buildCommand) {
    try {
      await runBuild(buildCommand);
      process.stdout.write("  Build completed successfully\n");
    } catch (err) {
      process.stdout.write(`  Build failed: ${err.message}\n`);
      process.stdout.write("  Continuing with release...\n");
    }
  } else {
    process.stdout.write("  No build command detected, skipping...\n");
  }

  process.stdout.write("\n[11/12] Staging all changes...\n");
  execCommand("git add -A", { silent: true });
  process.stdout.write("  All changes staged\n");

  const finalDiff = getGitDiff();
  const finalStat = getGitDiffStat();
  const finalChangedFiles = getChangedFiles();

  process.stdout.write("\n[12/12] Committing and pushing...\n");
  process.stdout.write("  Generating commit message with AI...\n");
  const commitMessage = await generateCommitMessage(apiKey, newVersion, finalDiff, finalStat, finalChangedFiles);

  try {
    const tempFile = path.join(PROJECT_ROOT, ".commit-msg-temp");
    fs.writeFileSync(tempFile, commitMessage, "utf-8");
    execCommand(`git commit -F "${tempFile}"`, { silent: true });
    fs.unlinkSync(tempFile);
    process.stdout.write("  Committed successfully\n");

    process.stdout.write("  Pushing to origin/main...\n");
    execCommand("git push origin main", { silent: true });
    process.stdout.write("  Pushed successfully\n");
  } catch (err) {
    process.stdout.write(`  Git error: ${err.message}\n`);
  }

  process.stdout.write("\n========================================\n");
  process.stdout.write(`  Release v${newVersion} complete!\n`);
  process.stdout.write("========================================\n\n");
}

main().catch((err) => {
  console.error("\nRelease failed:", err.message);
  process.exit(1);
});
