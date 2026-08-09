import fs from 'node:fs';
import path from 'node:path';

const DATABASE_URL = process.env.DATABASE_URL ?? 'file:./dev.db';

function extractDbPath(url: string): string {
  if (!url.startsWith('file:')) {
    throw new Error(`Unsupported database URL protocol: ${url}`);
  }
  const relative = url.slice('file:'.length);
  return path.isAbsolute(relative)
    ? relative
    : path.resolve(process.cwd(), relative);
}

function main(): void {
  const dbPath = extractDbPath(DATABASE_URL);
  if (!fs.existsSync(dbPath)) {
    throw new Error(`Database file not found: ${dbPath}`);
  }

  const backupDir = path.resolve(process.cwd(), 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `dev-${timestamp}.db`);

  fs.copyFileSync(dbPath, backupPath);
  console.log(`Backup created: ${backupPath}`);
}

main();
