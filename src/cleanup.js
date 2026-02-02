import fs from "fs";
import path from "path";

const IGNORE_DIRS = ["node_modules", "dist", "build", ".git", "coverage", ".next", ".cache"];
const JS_EXTENSIONS = [".js", ".jsx", ".ts", ".tsx"];
const CSS_EXTENSIONS = [".css"];

function getAllFiles(dir, extensions, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.includes(entry.name)) {
        getAllFiles(fullPath, extensions, files);
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (extensions.includes(ext)) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

function removeConsoleLogs(content) {
  let result = content;

  result = result.replace(/console\.log\s*\((?:[^)(]+|\((?:[^)(]+|\([^)(]*\))*\))*\)\s*;?\s*\n?/g, "");

  result = result.replace(/^\s*\n/gm, "\n");
  result = result.replace(/\n{3,}/g, "\n\n");

  return result;
}

function extractCssClasses(cssContent) {
  const classRegex = /\.([a-zA-Z_][\w-]*)/g;
  const classes = new Set();
  let match;

  while ((match = classRegex.exec(cssContent)) !== null) {
    classes.add(match[1]);
  }

  return classes;
}

function isClassUsedInJsFiles(className, jsFiles) {
  const patterns = [
    new RegExp(`['"\`]${className}['"\`]`, "g"),
    new RegExp(`className\\s*=\\s*['"\`][^'"\`]*\\b${className}\\b[^'"\`]*['"\`]`, "g"),
    new RegExp(`className\\s*=\\s*\\{[^}]*['"\`][^'"\`]*\\b${className}\\b[^'"\`]*['"\`][^}]*\\}`, "g"),
    new RegExp(`styles\\.${className}\\b`, "g"),
    new RegExp(`\\[['"\`]${className}['"\`]\\]`, "g"),
    new RegExp(`classList\\.(add|remove|toggle|contains)\\s*\\(['"\`]${className}['"\`]\\)`, "g"),
  ];

  for (const jsFile of jsFiles) {
    try {
      const content = fs.readFileSync(jsFile, "utf-8");
      for (const pattern of patterns) {
        if (pattern.test(content)) {
          return true;
        }
        pattern.lastIndex = 0;
      }
    } catch {
    }
  }

  return false;
}

function removeUnusedCssClasses(cssContent, jsFiles) {
  const lines = cssContent.split("\n");
  const result = [];
  let inRuleBlock = false;
  let braceCount = 0;
  let skipCurrentRule = false;

  for (const line of lines) {
    if (!inRuleBlock) {
      const selectorMatch = line.match(/^(\s*)(\.([a-zA-Z_][\w-]*)[^{]*)\{?\s*$/);

      if (selectorMatch) {
        const className = selectorMatch[3];
        const hasOpenBrace = line.includes("{");
        const hasCloseBrace = line.includes("}");

        if (!isClassUsedInJsFiles(className, jsFiles)) {
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
  const srcDir = path.join(projectRoot, "src");
  const stats = {
    consoleLogsRemoved: 0,
    cssClassesRemoved: 0,
    filesProcessed: 0,
  };

  if (!fs.existsSync(srcDir)) {
    return stats;
  }

  const jsFiles = getAllFiles(srcDir, JS_EXTENSIONS);
  const cssFiles = getAllFiles(srcDir, CSS_EXTENSIONS);

  for (const file of jsFiles) {
    try {
      const content = fs.readFileSync(file, "utf-8");
      const cleaned = removeConsoleLogs(content);

      if (cleaned !== content) {
        fs.writeFileSync(file, cleaned, "utf-8");
        const removed = (content.match(/console\.log/g) || []).length -
          (cleaned.match(/console\.log/g) || []).length;
        stats.consoleLogsRemoved += removed;
        stats.filesProcessed++;
        }
    } catch (err) {
      }
  }

  for (const file of cssFiles) {
    try {
      const content = fs.readFileSync(file, "utf-8");
      const classesBefore = extractCssClasses(content).size;
      const cleaned = removeUnusedCssClasses(content, jsFiles);
      const classesAfter = extractCssClasses(cleaned).size;
      const removed = classesBefore - classesAfter;

      if (cleaned !== content) {
        fs.writeFileSync(file, cleaned, "utf-8");
        stats.cssClassesRemoved += removed;
        stats.filesProcessed++;
        }
    } catch (err) {
      }
  }

  return stats;
}
