// AlignOS Design System - Colors
// Based on Linear + Notion + Apple Health aesthetic

export const Colors = {
  // Backgrounds
  Background: '#0F1115',
  Surface: '#151922',
  SurfaceElevated: '#1B202B',
  
  // Borders
  Border: '#232834',
  
  // Text
  TextPrimary: '#F3F4F6',
  TextSecondary: '#9CA3AF',
  TextMuted: '#6B7280',
  
  // Accent
  AccentPrimary: '#22D3EE',
  AccentSecondary: '#38BDF8',
  
  // Status
  Success: '#14B8A6',
  Warning: '#F59E0B',
  Error: '#EF4444',
  
  // Transparent overlays
  Overlay: 'rgba(15, 17, 21, 0.92)',
  Scrim: 'rgba(0, 0, 0, 0.5)',
} as const;

export type ColorKey = keyof typeof Colors;
