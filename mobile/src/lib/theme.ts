// PayNavigate palette - the same tokens as the web dashboard (dashboard/src/index.css).
const T = {
  bg: '#F4F5F3',
  ink: '#202C29',
  brand: '#26734D',
  brandDark: '#1D5C3D',
  brandSoft: '#E3EFE7',
  sage: '#E5EAE2',
  card: '#FFFFFF',
  muted: '#737A74',
  subtle: '#5F665F', // small text on the page background (keeps 4.5:1 contrast)
  line: '#E3E6E1',
  field: '#F1F3EF',
  danger: '#C24128',
  dangerSoft: '#FBE9E4',
  amber: '#8A5A00',
  amberSoft: '#FBF0D6',
  info: '#2B5F8A',
  infoSoft: '#E5EEF6',
};

export const C = {
  ...T,
  // Names used by the statement screens
  teal: T.brandDark,
  tealSoft: T.brandSoft,
  cream: T.bg,
  orange: T.brand,
  orangeSoft: T.brandSoft,
  good: T.brand,
  bad: T.danger,
  warnBg: T.amberSoft,
  infoBg: T.infoSoft,
};

/** Inter, one family per weight (custom fonts don't synthesise weights on Android). */
export const F = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};

export const SCHEME_COLOURS: Record<string, string> = {
  Eftpos: '#26734D',
  Visa: '#2F5D8A',
  Mastercard: '#B0563A',
  Amex: '#8A6D1F',
  Other: T.muted,
};

/** Fee drivers: sequential greens, darkest for the largest. */
export const DRIVER_COLOURS = ['#1D5C3D', '#2F7D55', '#5E9C7A', '#93BBA3', '#C7D9CC'];

export const shadow = {
  shadowColor: '#202C29',
  shadowOpacity: 0.04,
  shadowRadius: 2,
  shadowOffset: { width: 0, height: 1 },
  elevation: 1,
};
