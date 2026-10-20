import type { Family, FamilyMember, Outcome } from '@/api/client';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isFamilyId(id: string | undefined): id is string {
  return id !== undefined && UUID.test(id);
}

/** Where to go once the families are known (SPEC 2.2.1). */
export function landing(outcome: Outcome<Family[]>): string {
  if (outcome.status === 'unauthorized') return '/login';
  if (outcome.status !== 'ok') return '/me';
  const list = outcome.value;
  if (list.length === 1) return `/family?id=${list[0].id}`;
  return list.length >= 2 ? '/families' : '/me';
}

/** Translation key of the label shown next to a person. */
export function roleLabel(member: Pick<FamilyMember, 'role' | 'hasAccount'>): string {
  if (!member.hasAccount) return 'family.role.resource';
  return member.role === 'MANAGER' ? 'family.role.manager' : 'family.role.member';
}
