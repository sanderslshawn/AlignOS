/**
 * AlignOS Border Radius System
 */

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  pill: 999,
} as const;

export type RadiusToken = keyof typeof radius;
