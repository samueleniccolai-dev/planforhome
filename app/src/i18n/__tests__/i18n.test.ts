import { resolveLocale, translate } from '../index';

describe('resolveLocale', () => {
  it('maps any Italian tag to Italian', () => {
    expect(resolveLocale('it')).toBe('it');
    expect(resolveLocale('it-IT')).toBe('it');
    expect(resolveLocale('IT-ch')).toBe('it');
  });

  it('maps everything else to English', () => {
    expect(resolveLocale('en-US')).toBe('en');
    expect(resolveLocale('fr-FR')).toBe('en');
    expect(resolveLocale('')).toBe('en');
    expect(resolveLocale(undefined)).toBe('en');
  });
});

describe('translate', () => {
  it('reads nested keys by dotted path in each language', () => {
    expect(translate('it', 'home.title')).toBe('Benvenuto in planforhome');
    expect(translate('en', 'home.title')).toBe('Welcome to planforhome');
  });

  it('returns the key itself when it is missing', () => {
    expect(translate('en', 'no.such.key')).toBe('no.such.key');
    expect(translate('it', 'home')).toBe('home');
  });
});

describe('interpolation', () => {
  it('replaces {name} in each language', () => {
    expect(translate('it', 'me.greeting', { name: 'Giulia' })).toBe('Ciao, Giulia');
    expect(translate('en', 'me.greeting', { name: 'Giulia' })).toBe('Hi, Giulia');
  });

  it('leaves unknown placeholders alone', () => {
    expect(translate('en', 'me.greeting', {})).toBe('Hi, {name}');
  });
});
