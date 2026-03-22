/**
 * AlignOS Theme Hook
 */

import { theme } from './theme';

/**
 * Hook to access theme tokens
 * Returns the global theme object
 */
export function useTheme() {
  return theme;
}
