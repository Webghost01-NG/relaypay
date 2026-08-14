#!/usr/bin/env node

/**
 * RelayPay FDC Relayer Daemon — CLI Entry Point
 *
 * Usage:
 *   npm run start
 *   node dist/cli.js
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { RelayPayDaemon } from './index.js';

// Load .env files
function loadEnvFile(filePath: string): void {
  try {
    const content = readFileSync(filePath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim();
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  } catch {
    // File not found, skip
  }
}

// Try root .env then local .env
loadEnvFile(resolve(process.cwd(), '../../.env'));
loadEnvFile(resolve(process.cwd(), '.env'));

console.log('');
console.log('╔══════════════════════════════════════════════════╗');
console.log('║     RelayPay FDC Relayer Daemon v1.0             ║');
console.log('║     Non-Custodial XRP → Flare Fulfillment        ║');
console.log('╚══════════════════════════════════════════════════╝');
console.log('');

const daemon = new RelayPayDaemon();

process.on('SIGINT', () => {
  console.log('\n[DAEMON] Shutting down gracefully...');
  daemon.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  daemon.stop();
  process.exit(0);
});

daemon.start();
