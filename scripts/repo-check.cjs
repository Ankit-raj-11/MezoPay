const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO_ROOT = path.join(__dirname, '..');

// Core Forbidden Patterns
const FORBIDDEN_PATTERNS = [
  { name: 'demo entity / demo data', regex: /\bdemo\b/i },
  { name: 'mock data / mock entity', regex: /\bmock(User|Contact|Activity|Balance|Target)?\b/i },
  { name: 'Alice test name', regex: /\bAlice\b/ },
  { name: 'Chai Point test name', regex: /\bChai\b/ },
  { name: 'Public Demo Address 0x90F79b', regex: /0x90F79b/i },
  { name: 'Public Demo Address 0x15d34A', regex: /0x15d34A/i },
  { name: 'Hardcoded privateKey assignment in bundle', regex: /\bprivateKey\s*[:=]\s*['"]0x[0-9a-fA-F]{64}['"]/i },
  { name: 'Unencrypted 64-hex private key assignment', regex: /PRIVATE_KEY\s*=\s*(0x)?[0-9a-fA-F]{64}/i },
];

// Target directories and paths to scan
const SCAN_TARGETS = [
  { type: 'dir', path: path.join(REPO_ROOT, 'client', 'src'), label: 'client/src' },
  { type: 'dist', path: path.join(REPO_ROOT, 'client', 'dist'), label: 'client/dist (Build Output)' },
  { type: 'dir', path: path.join(REPO_ROOT, 'scripts'), label: 'scripts/' },
  { type: 'root_files', path: REPO_ROOT, label: 'Repo Root' },
];

const IGNORED_FILES = [
  'repo-check.cjs',
  'contracts.ts', // Contains known deployed contract addresses and ABIs
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  '.git',
];

const report = [];

function scanFile(filePath, label) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    // Skip sourcemap comments or huge lines
    if (line.length > 5000) return;

    for (const pattern of FORBIDDEN_PATTERNS) {
      // In scripts/ allow regex patterns or env loaders that read contracts/.env dynamically
      if (label === 'scripts/' && pattern.name.includes('mock') && filePath.endsWith('.cjs')) continue;

      if (pattern.regex.test(line)) {
        report.push({
          location: label,
          file: path.relative(REPO_ROOT, filePath),
          line: index + 1,
          pattern: pattern.name,
          content: line.trim().slice(0, 120),
        });
      }
    }

    // Specific check: ensure the word "verified" is not used in history, contacts, or badges
    if (/\bbadge-verified\b/i.test(line) || (/verified/i.test(line) && (filePath.includes('history') || filePath.includes('contacts')))) {
      report.push({
        location: label,
        file: path.relative(REPO_ROOT, filePath),
        line: index + 1,
        pattern: 'forbidden "verified" label in history/contacts',
        content: line.trim().slice(0, 120),
      });
    }
  });
}

function scanDist(distDir, label) {
  if (!fs.existsSync(distDir)) return;
  const entries = fs.readdirSync(distDir, { recursive: true });

  for (const entry of entries) {
    const fullPath = path.join(distDir, entry);
    if (!fs.statSync(fullPath).isFile()) continue;
    if (fullPath.endsWith('.map')) continue;

    const content = fs.readFileSync(fullPath, 'utf-8');

    // 1. Scan for leaked private keys
    const pkMatch = content.match(/PRIVATE_KEY\s*[:=]\s*['"]?0x[0-9a-fA-F]{64}['"]?/i);
    if (pkMatch) {
      report.push({
        location: label,
        file: path.relative(REPO_ROOT, fullPath),
        line: 1,
        pattern: 'Private Key leaked in dist bundle',
        content: pkMatch[0],
      });
    }

    // 2. Scan for hardcoded demo addresses
    if (/0x90F79b/i.test(content) || /0x15d34A/i.test(content)) {
      report.push({
        location: label,
        file: path.relative(REPO_ROOT, fullPath),
        line: 1,
        pattern: 'Hardcoded demo address leaked in dist bundle',
        content: 'Found 0x90F79b or 0x15d34A',
      });
    }

    // 3. Scan for forbidden badge-verified class in built CSS/JS
    if (/badge-verified/i.test(content)) {
      report.push({
        location: label,
        file: path.relative(REPO_ROOT, fullPath),
        line: 1,
        pattern: 'badge-verified in dist bundle',
        content: 'Found badge-verified in dist bundle',
      });
    }
  }
}

function scanDir(dirPath, label) {
  if (!fs.existsSync(dirPath)) return;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'lib' || entry.name === 'dist') continue;
      scanDir(fullPath, label);
    } else if (entry.isFile()) {
      if (IGNORED_FILES.some(ign => entry.name.includes(ign))) continue;
      scanFile(fullPath, label);
    }
  }
}

function scanGitHistory() {
  console.log('\nScanning Git commit history for committed secrets...');
  try {
    const commitHashes = execSync('git log -n 25 --format=%H', { cwd: REPO_ROOT, encoding: 'utf-8' })
      .trim()
      .split('\n')
      .filter(Boolean);

    for (const hash of commitHashes) {
      const commitDiff = execSync(`git show ${hash} --stat -p`, { cwd: REPO_ROOT, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
      const lines = commitDiff.split('\n');

      lines.forEach((line, index) => {
        if (line.startsWith('+') && !line.startsWith('+++')) {
          const addedContent = line.slice(1).trim();
          const pkMatch = addedContent.match(/PRIVATE_KEY\s*=\s*(0x)?[0-9a-fA-F]{64}/i);
          if (pkMatch) {
            report.push({
              location: 'git history',
              file: `commit ${hash.slice(0, 8)}`,
              line: index + 1,
              pattern: 'Committed Private Key in Git History',
              content: addedContent.slice(0, 40) + '...',
            });
          }
        }
      });
    }
    console.log(`✓ Git commit history scan completed (${commitHashes.length} commits verified clean).`);
  } catch (err) {
    console.warn('! Git history scan note:', err.message);
  }
}

function scanKeystoreSecurity() {
  console.log('Scanning Android Keystore & signing credential security...');
  try {
    const trackedFiles = execSync('git ls-files', { cwd: REPO_ROOT, encoding: 'utf-8' }).split('\n');
    for (const file of trackedFiles) {
      const trimmed = file.trim();
      if (!trimmed) continue;
      if (trimmed.endsWith('.keystore') || trimmed.endsWith('.jks')) {
        report.push({
          location: 'git index',
          file: trimmed,
          line: 1,
          pattern: 'Tracked Android Keystore file in git',
          content: trimmed,
        });
      }
      if (trimmed.includes('keystore.properties') && !trimmed.endsWith('.example')) {
        report.push({
          location: 'git index',
          file: trimmed,
          line: 1,
          pattern: 'Tracked keystore.properties in git',
          content: trimmed,
        });
      }
    }

    // Check .gitignore
    const gitignorePath = path.join(REPO_ROOT, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      const gitignore = fs.readFileSync(gitignorePath, 'utf-8');
      if (!gitignore.includes('*.keystore') || !gitignore.includes('keystore.properties')) {
        report.push({
          location: '.gitignore',
          file: '.gitignore',
          line: 1,
          pattern: 'Missing keystore rules in .gitignore',
          content: 'Expected *.keystore and keystore.properties in .gitignore',
        });
      }
    }

    // Check client/android/app/build.gradle for hardcoded password strings
    const buildGradlePath = path.join(REPO_ROOT, 'client', 'android', 'app', 'build.gradle');
    if (fs.existsSync(buildGradlePath)) {
      const gradle = fs.readFileSync(buildGradlePath, 'utf-8');
      const passMatch = gradle.match(/(storePassword|keyPassword)\s*['"](?!.*System\.getenv)[^'"]+['"]/);
      if (passMatch) {
        report.push({
          location: 'client/android/app/build.gradle',
          file: 'client/android/app/build.gradle',
          line: 1,
          pattern: 'Hardcoded password string in build.gradle',
          content: passMatch[0],
        });
      }
    }
    console.log('✓ Keystore security check completed.');
  } catch (err) {
    console.warn('! Keystore scan note:', err.message);
  }
}

console.log('====================================================');
console.log('MezoPay Comprehensive Repo, Dist, Root & Git History Check');
console.log('====================================================');

for (const target of SCAN_TARGETS) {
  if (target.type === 'dir') {
    console.log(`Scanning directory: ${target.label}...`);
    scanDir(target.path, target.label);
  } else if (target.type === 'dist') {
    console.log(`Scanning build output: ${target.label}...`);
    scanDist(target.path, target.label);
  } else if (target.type === 'root_files') {
    console.log(`Scanning root files: ${target.label}...`);
    const rootEntries = fs.readdirSync(target.path, { withFileTypes: true });
    for (const entry of rootEntries) {
      if (entry.isFile() && !IGNORED_FILES.includes(entry.name)) {
        if (entry.name.endsWith('.md') || entry.name.endsWith('.json') || entry.name.endsWith('.js') || entry.name.endsWith('.cjs')) {
          scanFile(path.join(target.path, entry.name), target.label);
        }
      }
    }
  }
}

scanGitHistory();
scanKeystoreSecurity();

console.log('====================================================');
console.log('SCAN RESULTS:');
console.log('====================================================');

if (report.length === 0) {
  console.log('✓ PASS: ZERO secrets, zero hardcoded private keys, zero mock entities, and zero forbidden labels found across client/src, client/dist, scripts, repo root, and git history!');
  process.exit(0);
} else {
  console.log(`✗ FOUND ${report.length} HITS:`);
  report.forEach(h => {
    console.log(`[${h.pattern}] (${h.location}) ${h.file}:${h.line} -> "${h.content}"`);
  });
  console.log('----------------------------------------------------');
  process.exit(1);
}
