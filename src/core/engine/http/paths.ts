import { existsSync } from 'fs';
import { homedir } from 'os';
import { join, resolve } from 'path';

function getCurrentDir(): string {
  return typeof __dirname !== 'undefined' ? __dirname : process.cwd();
}

export function resolvePluginRoot(): string {
  const currentDir = getCurrentDir();
  const candidates = [
    resolve(currentDir, '../..'),
    resolve(currentDir, '../../../..'),
    process.cwd(),
    join(homedir(), '.claude', 'plugins', 'marketplaces', 'nhevers'),
  ];

  for (const candidate of candidates) {
    if (existsSync(join(candidate, 'package.json'))) {
      return candidate;
    }
  }

  return candidates[0];
}

export function resolvePluginPath(...segments: string[]): string {
  return join(resolvePluginRoot(), ...segments);
}
