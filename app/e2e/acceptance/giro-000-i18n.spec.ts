/// <reference types="node" />
import { expect, test } from '@playwright/test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Round 000, T2: the two dictionaries match and every key used in the code exists in both.
// No browser: it reads the files of the app.

const APP = resolve(__dirname, '..', '..');

type Dictionary = { [key: string]: unknown };

function flatten(node: Dictionary, prefix = ''): Map<string, unknown> {
  const out = new Map<string, unknown>();
  for (const [name, value] of Object.entries(node)) {
    const key = prefix ? `${prefix}.${name}` : name;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      for (const [k, v] of flatten(value as Dictionary, key)) out.set(k, v);
    } else {
      out.set(key, value);
    }
  }
  return out;
}

function dictionary(locale: 'it' | 'en'): Map<string, unknown> {
  const file = join(APP, 'src', 'i18n', `${locale}.json`);
  return flatten(JSON.parse(readFileSync(file, 'utf8')) as Dictionary);
}

function sourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name === '__tests__' || name === 'node_modules') continue;
      files.push(...sourceFiles(path));
    } else if (/\.(ts|tsx)$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name)) {
      files.push(path);
    }
  }
  return files;
}

// t('a.b'), t("a.b") and t(`a.b`), with optional spaces (also i18n.t(...)); not split(), format().
const T_CALL = /(?<![\w$])t\(\s*(['"`])([^'"`$]+?)\1\s*[,)]/g;

function keysUsedIn(source: string): string[] {
  return [...source.matchAll(T_CALL)].map((m) => m[2]);
}

function usedKeys(): Map<string, string> {
  const used = new Map<string, string>();
  for (const dir of ['app', 'src']) {
    for (const file of sourceFiles(join(APP, dir))) {
      for (const key of keysUsedIn(readFileSync(file, 'utf8'))) used.set(key, file);
    }
  }
  return used;
}

test('the key finder sees single, double and backtick quotes', () => {
  expect(keysUsedIn(`t('home.title') t("home.subtitle") t(\`a.b\`) t( 'c.d' , 'it')`)).toEqual([
    'home.title',
    'home.subtitle',
    'a.b',
    'c.d',
  ]);
  expect(keysUsedIn(`split('.') format("x") useT()`)).toEqual([]);
});

test('Italian and English have the same keys', () => {
  const it = [...dictionary('it').keys()].sort();
  const en = [...dictionary('en').keys()].sort();
  expect(it.length).toBeGreaterThan(0);
  expect(en).toEqual(it);
});

test('no translation is empty or not a string', () => {
  for (const locale of ['it', 'en'] as const) {
    for (const [key, value] of dictionary(locale)) {
      expect(typeof value, `${locale}: ${key}`).toBe('string');
      expect((value as string).trim(), `${locale}: ${key}`).not.toBe('');
    }
  }
});

test('every key used with t() exists in both languages', () => {
  const used = usedKeys();
  expect(used.size, 'at least one key is used in app/ or src/').toBeGreaterThan(0);
  expect([...used.keys()]).toContain('home.title');
  expect([...used.keys()]).toContain('home.subtitle');
  const it = dictionary('it');
  const en = dictionary('en');
  for (const [key, file] of used) {
    expect(it.has(key), `${key} (${file}) in it.json`).toBe(true);
    expect(en.has(key), `${key} (${file}) in en.json`).toBe(true);
  }
});
