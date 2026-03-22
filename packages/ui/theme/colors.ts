/**
 * AlignOS Color System
 * Premium OS-level color palette
 */

export const colors = {
  // Base
  background: '#0F1115',
  surface: '#151922',
  surfaceElevated: '#1B202B',
  
  // Borders
  border: '#232834',
  borderSubtle: '#1E242F',
  borderFocus: '#22D3EE',
  
  // Text
  textPrimary: '#F3F4F6',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
  
  // Accent (Cyan family only)
  accentPrimary: '#22D3EE',
  accentSecondary: '#38BDF8',
  accentSoft: '#22D3EE15', // 8% opacity
  accentPressed: '#1E9BA9',
  
  // Status
  success: '#14B8A6',
  successSoft: '#14B8A615',
  warning: '#F59E0B',
  warningSoft: '#F59E0B15',
  error: '#EF4444',
  errorSoft: '#EF444415',
  
  // Overlay
  overlay: '#00000080', // 50% black
  overlayHeavy: '#000000CC', // 80% black
  
  // Shadow
  shadowPrimary: '#00000040', // 25% black
  shadowSecondary: '#00000020', // 12% black
  
  // Chart colors (cyan/slate family only)
  chartPrimary: '#22D3EE',
  chartSecondary: '#38BDF8',
  chartTertiary: '#67E8F9',
  chartMuted: '#475569',
  chartBackground: '#1E293B',
} as const;

export type ColorToken = keyof typeof colors;
