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
