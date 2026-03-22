// AlignOS Design System - Border Radius

export const Radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  pill: 999,
} as const;

export type RadiusKey = keyof typeof Radius;
