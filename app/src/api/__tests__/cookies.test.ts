import { csrfHeaders, readCookie } from '../client';

describe('readCookie', () => {
  it('finds a cookie among several', () => {
    expect(readCookie('a=1; pfh_csrf=abc-_9; b=2', 'pfh_csrf')).toBe('abc-_9');
  });

  it('does not match a longer name', () => {
    expect(readCookie('x_pfh_csrf=no', 'pfh_csrf')).toBeUndefined();
  });

  it('is undefined when the cookie is missing or the jar empty', () => {
    expect(readCookie('', 'pfh_csrf')).toBeUndefined();
    expect(readCookie('a=1', 'pfh_csrf')).toBeUndefined();
  });
});

describe('csrfHeaders', () => {
  it('adds X-CSRF-Token from the jar', () => {
    expect(csrfHeaders('pfh_csrf=tok')).toEqual({ 'X-CSRF-Token': 'tok' });
  });

  it('adds nothing without the cookie', () => {
    expect(csrfHeaders('')).toEqual({});
  });
});
