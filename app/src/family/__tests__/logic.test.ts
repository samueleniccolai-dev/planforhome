import type { Family, Outcome } from '@/api/client';

import { isFamilyId, landing, roleLabel } from '../logic';

const family = (id: string): Family => ({
  id,
  name: `Family ${id}`,
  timeZone: 'Europe/Rome',
  role: 'MEMBER',
});
const ok = (list: Family[]): Outcome<Family[]> => ({ status: 'ok', value: list });

describe('landing', () => {
  it('goes straight into the only family', () => {
    expect(landing(ok([family('abc')]))).toBe('/family?id=abc');
  });

  it('asks to choose with two or more families', () => {
    expect(landing(ok([family('a'), family('b')]))).toBe('/families');
    expect(landing(ok([family('a'), family('b'), family('c')]))).toBe('/families');
  });

  it('falls back to /me with no families, on error and on not found', () => {
    expect(landing(ok([]))).toBe('/me');
    expect(landing({ status: 'error' })).toBe('/me');
    expect(landing({ status: 'notFound' })).toBe('/me');
  });

  it('goes to /login without a session', () => {
    expect(landing({ status: 'unauthorized' })).toBe('/login');
  });
});

describe('roleLabel', () => {
  const member = (role: 'MANAGER' | 'MEMBER', hasAccount: boolean) => ({
    personId: 'p',
    displayName: 'P',
    role,
    hasAccount,
    referentPersonId: null,
  });

  it('maps a resource (no account) whatever its role', () => {
    expect(roleLabel(member('MEMBER', false))).toBe('family.role.resource');
    expect(roleLabel(member('MANAGER', false))).toBe('family.role.resource');
  });

  it('maps managers and members with an account', () => {
    expect(roleLabel(member('MANAGER', true))).toBe('family.role.manager');
    expect(roleLabel(member('MEMBER', true))).toBe('family.role.member');
  });
});

describe('isFamilyId', () => {
  it('accepts a UUID and rejects anything else', () => {
    expect(isFamilyId('0192a3b4-0000-7000-8000-0000000000f2')).toBe(true);
    expect(isFamilyId('abc')).toBe(false);
    expect(isFamilyId('')).toBe(false);
    expect(isFamilyId(undefined)).toBe(false);
  });
});
