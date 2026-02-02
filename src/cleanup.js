import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACKAGE_SRC = __dirname;

const IGNORE_DIRS = [
  "node_modules",
  "dist",
  "build",
  ".git",
  "coverage",
  ".next",
  ".cache",
];
const JS_EXTENSIONS = [".js", ".jsx", ".ts", ".tsx"];
const CSS_EXTENSIONS = [".css"];

class CleanupError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = "CleanupError";
    this.code = code;
    this.details = details;
  }
}

const ErrorCodes = {
  INVALID_PROJECT_ROOT: "INVALID_PROJECT_ROOT",
  SRC_DIR_NOT_FOUND: "SRC_DIR_NOT_FOUND",
  FILE_READ_ERROR: "FILE_READ_ERROR",
  FILE_WRITE_ERROR: "FILE_WRITE_ERROR",
  PERMISSION_DENIED: "PERMISSION_DENIED",
  DIRECTORY_SCAN_ERROR: "DIRECTORY_SCAN_ERROR",
  INVALID_FILE_CONTENT: "INVALID_FILE_CONTENT",
};

function validateProjectRoot(projectRoot) {
  if (!projectRoot) {
    throw new CleanupError(
      "Project root path is required",
      ErrorCodes.INVALID_PROJECT_ROOT,
      { provided: projectRoot },
    );
  }

  if (typeof projectRoot !== "string") {
    throw new CleanupError(
      "Project root must be a string path",
      ErrorCodes.INVALID_PROJECT_ROOT,
      { provided: typeof projectRoot },
    );
  }

  const resolvedPath = path.resolve(projectRoot);

  try {
    const stats = fs.statSync(resolvedPath);
    if (!stats.isDirectory()) {
      throw new CleanupError(
        "Project root must be a directory",
        ErrorCodes.INVALID_PROJECT_ROOT,
        { path: resolvedPath },
      );
    }
  } catch (err) {
    if (err instanceof CleanupError) throw err;
    if (err.code === "ENOENT") {
      throw new CleanupError(
        "Project root directory does not exist",
        ErrorCodes.INVALID_PROJECT_ROOT,
        { path: resolvedPath },
      );
    }
    if (err.code === "EACCES") {
      throw new CleanupError(
        "Permission denied accessing project root",
        ErrorCodes.PERMISSION_DENIED,
        { path: resolvedPath },
      );
    }
    throw new CleanupError(
      `Failed to access project root: ${err.message}`,
      ErrorCodes.INVALID_PROJECT_ROOT,
      { path: resolvedPath, originalError: err.message },
    );
  }

  return resolvedPath;
}

function safeReadFile(filePath) {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch (err) {
    if (err.code === "ENOENT") {
      throw new CleanupError(
        `File not found: ${filePath}`,
        ErrorCodes.FILE_READ_ERROR,
        { path: filePath },
      );
    }
    if (err.code === "EACCES") {
      throw new CleanupError(
        `Permission denied reading file: ${filePath}`,
        ErrorCodes.PERMISSION_DENIED,
        { path: filePath },
      );
    }
    if (err.code === "EISDIR") {
      throw new CleanupError(
        `Path is a directory, not a file: ${filePath}`,
        ErrorCodes.FILE_READ_ERROR,
        { path: filePath },
      );
    }
    throw new CleanupError(
      `Failed to read file: ${err.message}`,
      ErrorCodes.FILE_READ_ERROR,
      { path: filePath, originalError: err.message },
    );
  }
}

function safeWriteFile(filePath, content) {
  try {
    fs.writeFileSync(filePath, content, "utf-8");
  } catch (err) {
    if (err.code === "EACCES") {
      throw new CleanupError(
        `Permission denied writing to file: ${filePath}`,
        ErrorCodes.PERMISSION_DENIED,
        { path: filePath },
      );
    }
    if (err.code === "ENOSPC") {
      throw new CleanupError(
        `No space left on device when writing: ${filePath}`,
        ErrorCodes.FILE_WRITE_ERROR,
        { path: filePath },
      );
    }
    if (err.code === "EROFS") {
      throw new CleanupError(
        `Read-only file system, cannot write: ${filePath}`,
        ErrorCodes.FILE_WRITE_ERROR,
        { path: filePath },
      );
    }
    throw new CleanupError(
      `Failed to write file: ${err.message}`,
      ErrorCodes.FILE_WRITE_ERROR,
      { path: filePath, originalError: err.message },
    );
  }
}

function isPackageFile(filePath) {
  return filePath.startsWith(PACKAGE_SRC);
}

function getAllFiles(dir, extensions, files = [], errors = []) {
  let entries;

  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    const errorInfo = {
      path: dir,
      code: err.code,
      message: err.message,
    };

    if (err.code === "EACCES") {
      errors.push({ ...errorInfo, type: "permission_denied" });
    } else if (err.code === "ENOENT") {
      errors.push({ ...errorInfo, type: "not_found" });
    } else {
      errors.push({ ...errorInfo, type: "unknown" });
    }

    return { files, errors };
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    try {
      if (entry.isDirectory()) {
        if (!IGNORE_DIRS.includes(entry.name)) {
          getAllFiles(fullPath, extensions, files, errors);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (extensions.includes(ext) && !isPackageFile(fullPath)) {
          files.push(fullPath);
        }
      }
    } catch (err) {
      errors.push({
        path: fullPath,
        code: err.code,
        message: err.message,
        type: "entry_access",
      });
    }
  }

  return { files, errors };
}

function removeConsoleLogs(content) {
  if (typeof content !== "string") {
    throw new CleanupError(
      "Invalid content type for console log removal",
      ErrorCodes.INVALID_FILE_CONTENT,
      { contentType: typeof content },
    );
  }

  let result = content;

  result = result.replace(
    /console\.log\s*\((?:[^)(]+|\((?:[^)(]+|\([^)(]*\))*\))*\)\s*;?\s*\n?/g,
    "",
  );
  result = result.replace(/^\s*\n/gm, "\n");
  result = result.replace(/\n{3,}/g, "\n\n");

  return result;
}

function extractCssClasses(cssContent) {
  if (typeof cssContent !== "string") {
    return new Set();
  }

  const classRegex = /\.([a-zA-Z_][\w-]*)/g;
  const classes = new Set();
  let match;

  while ((match = classRegex.exec(cssContent)) !== null) {
    classes.add(match[1]);
  }

  return classes;
}

function isClassUsedInJsFiles(className, jsFiles, fileCache = new Map()) {
  const patterns = [
    new RegExp(`['"\`]${className}['"\`]`, "g"),
    new RegExp(
      `className\\s*=\\s*['"\`][^'"\`]*\\b${className}\\b[^'"\`]*['"\`]`,
      "g",
    ),
    new RegExp(
      `className\\s*=\\s*\\{[^}]*['"\`][^'"\`]*\\b${className}\\b[^'"\`]*['"\`][^}]*\\}`,
      "g",
    ),
    new RegExp(`styles\\.${className}\\b`, "g"),
    new RegExp(`\\[['"\`]${className}['"\`]\\]`, "g"),
    new RegExp(
      `classList\\.(add|remove|toggle|contains)\\s*\\(['"\`]${className}['"\`]\\)`,
      "g",
    ),
  ];

  for (const jsFile of jsFiles) {
    try {
      let content;
      if (fileCache.has(jsFile)) {
        content = fileCache.get(jsFile);
      } else {
        content = safeReadFile(jsFile);
        fileCache.set(jsFile, content);
      }

      for (const pattern of patterns) {
        if (pattern.test(content)) {
          return true;
        }
        pattern.lastIndex = 0;
      }
    } catch {}
  }

  return false;
}

function removeUnusedCssClasses(cssContent, jsFiles) {
  if (typeof cssContent !== "string") {
    throw new CleanupError(
      "Invalid content type for CSS class removal",
      ErrorCodes.INVALID_FILE_CONTENT,
      { contentType: typeof cssContent },
    );
  }

  const fileCache = new Map();
  const lines = cssContent.split("\n");
  const result = [];
  let inRuleBlock = false;
  let braceCount = 0;
  let skipCurrentRule = false;

  for (const line of lines) {
    if (!inRuleBlock) {
      const selectorMatch = line.match(
        /^(\s*)(\.([a-zA-Z_][\w-]*)[^{]*)\{?\s*$/,
      );

      if (selectorMatch) {
        const className = selectorMatch[3];
        const hasOpenBrace = line.includes("{");
        const hasCloseBrace = line.includes("}");

        if (!isClassUsedInJsFiles(className, jsFiles, fileCache)) {
          if (hasOpenBrace && hasCloseBrace) {
            skipCurrentRule = false;
          } else if (hasOpenBrace) {
            inRuleBlock = true;
            braceCount = 1;
            skipCurrentRule = true;
          }
        } else {
          result.push(line);
          if (hasOpenBrace && !hasCloseBrace) {
            inRuleBlock = true;
            braceCount = 1;
            skipCurrentRule = false;
          }
        }
      } else {
        result.push(line);

        if (line.includes("{") && !line.includes("}")) {
          inRuleBlock = true;
          braceCount = 1;
          skipCurrentRule = false;
        }
      }
    } else {
      if (!skipCurrentRule) {
        result.push(line);
      }

      braceCount += (line.match(/{/g) || []).length;
      braceCount -= (line.match(/}/g) || []).length;

      if (braceCount <= 0) {
        inRuleBlock = false;
        skipCurrentRule = false;
      }
    }
  }

  return result.join("\n");
}

export async function run(projectRoot) {
  const stats = {
    consoleLogsRemoved: 0,
    cssClassesRemoved: 0,
    filesProcessed: 0,
    errors: [],
    warnings: [],
  };

  let resolvedRoot;
  try {
    resolvedRoot = validateProjectRoot(projectRoot);
  } catch (err) {
    if (err instanceof CleanupError) {
      stats.errors.push({
        code: err.code,
        message: err.message,
        details: err.details,
      });
      return stats;
    }
    throw err;
  }

  const srcDir = path.join(resolvedRoot, "src");

  if (!fs.existsSync(srcDir)) {
    stats.warnings.push({
      code: ErrorCodes.SRC_DIR_NOT_FOUND,
      message: `Source directory not found: ${srcDir}`,
      details: { path: srcDir },
    });
    return stats;
  }

  const jsResult = getAllFiles(srcDir, JS_EXTENSIONS);
  const cssResult = getAllFiles(srcDir, CSS_EXTENSIONS);

  if (jsResult.errors.length > 0) {
    stats.warnings.push(
      ...jsResult.errors.map((e) => ({
        code: ErrorCodes.DIRECTORY_SCAN_ERROR,
        message: `Failed to scan directory: ${e.path}`,
        details: e,
      })),
    );
  }

  if (cssResult.errors.length > 0) {
    stats.warnings.push(
      ...cssResult.errors.map((e) => ({
        code: ErrorCodes.DIRECTORY_SCAN_ERROR,
        message: `Failed to scan directory: ${e.path}`,
        details: e,
      })),
    );
  }

  const jsFiles = jsResult.files;
  const cssFiles = cssResult.files;

  for (const file of jsFiles) {
    try {
      const content = safeReadFile(file);
      const cleaned = removeConsoleLogs(content);

      if (cleaned !== content) {
        safeWriteFile(file, cleaned);
        const removed =
          (content.match(/console\.log/g) || []).length -
          (cleaned.match(/console\.log/g) || []).length;
        stats.consoleLogsRemoved += removed;
        stats.filesProcessed++;
      }
    } catch (err) {
      if (err instanceof CleanupError) {
        stats.errors.push({
          code: err.code,
          message: err.message,
          details: err.details,
        });
      } else {
        stats.errors.push({
          code: "UNKNOWN_ERROR",
          message: `Unexpected error processing ${file}: ${err.message}`,
          details: { path: file },
        });
      }
    }
  }

  for (const file of cssFiles) {
    try {
      const content = safeReadFile(file);
      const classesBefore = extractCssClasses(content).size;
      const cleaned = removeUnusedCssClasses(content, jsFiles);
      const classesAfter = extractCssClasses(cleaned).size;
      const removed = classesBefore - classesAfter;

      if (cleaned !== content) {
        safeWriteFile(file, cleaned);
        stats.cssClassesRemoved += removed;
        stats.filesProcessed++;
      }
    } catch (err) {
      if (err instanceof CleanupError) {
        stats.errors.push({
          code: err.code,
          message: err.message,
          details: err.details,
        });
      } else {
        stats.errors.push({
          code: "UNKNOWN_ERROR",
          message: `Unexpected error processing ${file}: ${err.message}`,
          details: { path: file },
        });
      }
    }
  }

  return stats;
}

export { CleanupError, ErrorCodes };
