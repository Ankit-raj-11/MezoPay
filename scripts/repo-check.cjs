const fs = require('fs');
const path = require('path');

const FORBIDDEN_PATTERNS = [
  { name: 'demo (case-insensitive)', regex: /\bdemo\b/i },
  { name: 'mock (case-insensitive)', regex: /\bmock\b/i },
  { name: 'fallback (case-insensitive)', regex: /\bfallback\b/i },
  { name: 'default PIN 1234', regex: /1234/ },
  { name: 'Alice', regex: /\bAlice\b/ },
  { name: 'Chai', regex: /\bChai\b/ },
  { name: 'Public Demo Address 0x90F79b', regex: /0x90F79b/i },
  { name: 'Public Demo Address 0x15d34A', regex: /0x15d34A/i },
  { name: 'privateKey identifier', regex: /\bprivateKey\b/ },
  { name: '64-hex private key or secret', regex: /0x[0-9a-fA-F]{64}|(?<![0-9a-fA-F])[0-9a-fA-F]{64}(?![0-9a-fA-F])/ },
];

const SCAN_DIRS = [
  path.join(__dirname, '..', 'client', 'src'),
];

const IGNORED_FILES = [
  'repo-check.cjs',
  'contracts.ts', // may contain bytecode or keccak constants
];

let totalHits = 0;
const report = [];

function scanDir(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'lib') continue;
      scanDir(fullPath);
    } else if (entry.isFile()) {
      if (IGNORED_FILES.some(ign => entry.name.includes(ign))) continue;
      scanFile(fullPath);
    }
  }
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.regex.test(line)) {
        totalHits++;
        report.push({
          file: path.relative(path.join(__dirname, '..'), filePath),
          line: index + 1,
          pattern: pattern.name,
          content: line.trim(),
        });
      }
    }
  });
}

console.log('====================================================');
console.log('Running MezoPay Workstream 0 Repo Secret & Demo Check');
console.log('====================================================');

for (const dir of SCAN_DIRS) {
  scanDir(dir);
}

if (report.length === 0) {
  console.log('✓ PASS: Zero forbidden patterns, secrets, or demo items found in client/src!');
  process.exit(0);
} else {
  console.log(`✗ FOUND ${report.length} HITS:`);
  report.forEach(h => {
    console.log(`[${h.pattern}] ${h.file}:${h.line} -> "${h.content}"`);
  });
  console.log('----------------------------------------------------');
  process.exit(1);
}
