import { Injectable } from '@nestjs/common';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export interface LogEntry { at: string; level: 'info' | 'error'; event: string; detail?: string }

@Injectable()
export class PersistentLogService {
  private readonly file = path.resolve(process.env.KIOSK_LOG_FILE || './logs/kiosko-api.jsonl');
  async write(event: string, detail?: unknown, level: 'info' | 'error' = 'info') {
    const entry: LogEntry = { at: new Date().toISOString(), level, event, detail: detail instanceof Error ? detail.message : detail ? String(detail).slice(0, 500) : undefined };
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    await fs.appendFile(this.file, `${JSON.stringify(entry)}\n`, 'utf8');
  }
  async recent(limit = 200) {
    try { const content = await fs.readFile(this.file, 'utf8'); return content.trim().split(/\r?\n/).slice(-Math.min(500, Math.max(1, limit))).reverse().map(line => JSON.parse(line) as LogEntry); }
    catch { return []; }
  }
}
