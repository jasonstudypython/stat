import fs from "fs";
import path from "path";

const rootDir = process.cwd();
const targetDirs = ["app"];
const targetFiles = ["package.json"];
const fileExtensions = new Set([".js", ".jsx", ".ts", ".tsx", ".css", ".json"]);
const ignoreDirs = new Set(["node_modules", ".next", ".git"]);

const suspiciousPatterns = [
  { label: "question-run", pattern: /\?{3,}/g },
  { label: "replacement-char", pattern: /\uFFFD/g },
];

function shouldScanFile(filePath) {
  return fileExtensions.has(path.extname(filePath));
}

function walkDir(dirPath, collector) {
  if (!fs.existsSync(dirPath)) return;

  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    if (ignoreDirs.has(entry.name)) continue;

    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath, collector);
      continue;
    }

    if (shouldScanFile(fullPath)) {
      collector.push(fullPath);
    }
  }
}

function lineAndColumnFromIndex(text, index) {
  const before = text.slice(0, index);
  const lines = before.split("\n");
  const line = lines.length;
  const column = lines.at(-1).length + 1;
  return { line, column };
}

function collectMatches(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const findings = [];

  for (const { label, pattern } of suspiciousPatterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const { line, column } = lineAndColumnFromIndex(text, match.index);
      findings.push({
        label,
        line,
        column,
        snippet: match[0],
      });
    }
  }

  return findings;
}

const filesToScan = [];
for (const dir of targetDirs) {
  walkDir(path.join(rootDir, dir), filesToScan);
}

for (const file of targetFiles) {
  const fullPath = path.join(rootDir, file);
  if (fs.existsSync(fullPath)) {
    filesToScan.push(fullPath);
  }
}

const results = [];
for (const filePath of filesToScan) {
  const matches = collectMatches(filePath);
  if (matches.length > 0) {
    results.push({ filePath, matches });
  }
}

if (results.length > 0) {
  console.error("Korean encoding check failed.");
  for (const result of results) {
    console.error(`\n${path.relative(rootDir, result.filePath)}`);
    for (const match of result.matches) {
      console.error(
        `  [${match.label}] line ${match.line}, col ${match.column}: ${JSON.stringify(match.snippet)}`,
      );
    }
  }
  process.exit(1);
}

console.log("Korean encoding check passed.");
