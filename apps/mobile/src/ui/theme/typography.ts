// AlignOS Design System - Typography

export const Typography = {
  // Sizes
  TitleXL: 28,
  TitleL: 22,
  TitleM: 18,
  Body: 16,
  BodySmall: 14,
  Caption: 12,
  Micro: 11,
} as const;

export const FontWeight = {
  Bold: '700' as const,
  Semi: '600' as const,
  Medium: '500' as const,
  Regular: '400' as const,
} as const;

export type TypographyKey = keyof typeof Typography;
export type FontWeightKey = keyof typeof FontWeight;
