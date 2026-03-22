/**
 * AlignOS AppIcon Component
 * Consistent icon rendering across the app
 */

import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { iconMap, type IconName } from './icons';

interface AppIconProps {
  name: IconName;
  size?: number;
  color?: string;
}

export function AppIcon({ name, size = 24, color = '#9CA3AF' }: AppIconProps) {
  const ioniconName = iconMap[name] as keyof typeof Ionicons.glyphMap;
  
  return <Ionicons name={ioniconName} size={size} color={color} />;
}
