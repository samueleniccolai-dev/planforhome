import { deleteItemAsync, getItemAsync, setItemAsync } from 'expo-secure-store';

import type { Credentials, TokenVault } from './tokenSession';

const KEY = 'planforhome.session';

/** Android: the token and the person live in the encrypted store of Expo (Keystore). */
export const secureVault: TokenVault = {
  async get(): Promise<Credentials | null> {
    const raw = await getItemAsync(KEY);
    return raw ? (JSON.parse(raw) as Credentials) : null;
  },
  set: (credentials) => setItemAsync(KEY, JSON.stringify(credentials)),
  clear: () => deleteItemAsync(KEY),
};
