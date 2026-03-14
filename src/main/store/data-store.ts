/**
 * data-store.ts — Persistence layer for transcription history and user snippets.
 *
 * Main exports:
 *   - initDataStore(): void                  — seed auto-increment counters on startup
 *   - saveHistory(entry): void               — prepend to history (cap 50, FIFO)
 *   - getHistory(): HistoryEntry[]           — all history, newest first
 *   - deleteHistory(id): void               — remove single entry by id
 *   - getSnippets(): Snippet[]              — all snippets, newest first
 *   - addSnippet(title, content): void      — prepend snippet (uncapped)
 *   - deleteSnippet(id): void               — remove snippet by id
 *
 * I/O data types:
 *   - HistoryEntry → { id, text, appName, createdAt }
 *   - Snippet      → { id, title, content, createdAt }
 *
 * Design notes:
 *   - Stored in a separate electron-store file named "sonicscript-data" (not "settings")
 *     so history/snippets survive settings resets
 *   - IDs are auto-incrementing strings; counters are seeded from existing data on
 *     initDataStore() to avoid collisions across sessions
 *   - History cap is 50 entries (FIFO — oldest dropped); snippets are uncapped
 */
import Store from 'electron-store';
import type { HistoryEntry, Snippet } from '../../shared/types';

interface DataSchema {
  history: HistoryEntry[];
  snippets: Snippet[];
}

const dataStore = new Store<DataSchema>({
  name: 'sonicscript-data',
  defaults: {
    history: [],
    snippets: [],
  },
});

let nextHistoryId = 1;
let nextSnippetId = 1;

export function initDataStore(): void {
  const history = dataStore.get('history', []);
  const snippets = dataStore.get('snippets', []);
  nextHistoryId = history.reduce((max, h) => Math.max(max, Number(h.id) + 1), 1);
  nextSnippetId = snippets.reduce((max, s) => Math.max(max, Number(s.id) + 1), 1);
}

export function saveHistory(entry: { text: string; appName: string }): void {
  const history = dataStore.get('history', []);
  history.unshift({
    id: String(nextHistoryId++),
    text: entry.text,
    appName: entry.appName,
    createdAt: Date.now(),
  });
  // Keep only last 50
  dataStore.set('history', history.slice(0, 50));
}

export function getHistory(): HistoryEntry[] {
  return dataStore.get('history', []);
}

export function deleteHistory(id: string): void {
  const history = dataStore.get('history', []).filter(h => h.id !== id);
  dataStore.set('history', history);
}

export function getSnippets(): Snippet[] {
  return dataStore.get('snippets', []);
}

export function addSnippet(title: string, content: string): void {
  const snippets = dataStore.get('snippets', []);
  snippets.unshift({
    id: String(nextSnippetId++),
    title,
    content,
    createdAt: Date.now(),
  });
  dataStore.set('snippets', snippets);
}

export function deleteSnippet(id: string): void {
  const snippets = dataStore.get('snippets', []).filter(s => s.id !== id);
  dataStore.set('snippets', snippets);
}
