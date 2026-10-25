import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const APP = resolve(__dirname, '..', '..', '..');
const TOKENS = join(APP, 'src', 'ui', 'tokens.ts');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : files(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

it('no colour literal outside tokens.ts', () => {
  const offenders = [...files(join(APP, 'app')), ...files(join(APP, 'src'))]
    .filter((f) => f !== TOKENS)
    .filter((f) => /#[0-9a-fA-F]{3,8}\b/.test(readFileSync(f, 'utf8')));
  expect(offenders).toEqual([]);
});
