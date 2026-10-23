import type { TokenSession } from '@/api/tokenSession';

type Registration = { ensure(): Promise<unknown>; dispose(): void };
type Opener = { ready(): Promise<void>; dispose(): void };

/** Web: no push. Android has `push.native.ts`. */
export function createPush(_auth?: TokenSession): Registration | undefined {
  return undefined;
}

export function createOpener(_navigate: (href: string) => void): Opener | undefined {
  return undefined;
}
