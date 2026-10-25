// Design tokens (docs/DESIGN.md §3). The only file of the app with literal colours.

export const colors = {
  bg: '#F3F5F7',
  surface: '#FFFFFF',
  text: '#14181D',
  textSecondary: '#3E4854',
  border: '#C2CAD4',
  borderStrong: '#5D6876',
  accent: '#1849A9',
  onAccent: '#FFFFFF',
  accentTonal: '#E4EBF7',
  onAccentTonal: '#163E8F',
  danger: '#991B1B',
  dangerSoft: '#F9E3E1',
  warning: '#6E4A00',
  success: '#1E6B41',
  notice: '#FBF1D4',
  onNotice: '#5C430A',
  tagBg: '#E9EDF2',
  // Okabe-Ito, stable per person inside a family.
  person: ['#E69F00', '#56B4E9', '#009E73', '#F0E442', '#0072B2', '#D55E00', '#CC79A7', '#000000'],
  shadow: 'rgba(16,24,40,0.05)',
} as const;

export const type = {
  title: { fontSize: 24, lineHeight: 30, fontWeight: '700' },
  section: { fontSize: 14, lineHeight: 18, fontWeight: '700', letterSpacing: 1 },
  body: { fontSize: 18, lineHeight: 25, fontWeight: '400' },
  bodyStrong: { fontSize: 18, lineHeight: 25, fontWeight: '600' },
  meta: { fontSize: 16, lineHeight: 21, fontWeight: '400' },
  caption: { fontSize: 14, lineHeight: 19, fontWeight: '400' },
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16 } as const;
export const size = { touch: 48, touchPrimary: 56, checkbox: 28, avatar: 36 } as const;
export const screenMargin = 16;

export const elevation = {
  borderWidth: 1,
  borderColor: colors.border,
  boxShadow: `0 1px 2px ${colors.shadow}`,
} as const;
