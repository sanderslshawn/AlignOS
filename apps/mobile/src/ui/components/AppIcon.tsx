// AlignOS Icon Component
// Single source of truth for all icons

import React from 'react';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { Colors } from '../theme/colors';

export type IconName = 
  | 'walk' 
  | 'meal' 
  | 'caffeine' 
  | 'sleep' 
  | 'stress' 
  | 'brain' 
  | 'workout'
  | 'chart' 
  | 'settings' 
  | 'plus' 
  | 'chevron-right'
  | 'chevron-left'
  | 'chevron-down'
  | 'check'
  | 'close'
  | 'fire'
  | 'award'
  | 'target'
  | 'trending-up'
  | 'trending-down'
  | 'calendar'
  | 'clock'
  | 'refresh'
  | 'edit'
  | 'trash'
  | 'lock'
  | 'bell'
  | 'heart'
  | 'energy';

interface AppIconProps {
  name: IconName;
  size?: number;
  color?: string;
}

export function AppIcon({ name, size = 20, color = Colors.TextPrimary }: AppIconProps) {
  const iconMap: Record<IconName, React.ReactElement> = {
    walk: <Ionicons name="walk" size={size} color={color} />,
    meal: <Ionicons name="restaurant" size={size} color={color} />,
    caffeine: <Ionicons name="cafe" size={size} color={color} />,
    sleep: <Ionicons name="moon" size={size} color={color} />,
    stress: <MaterialCommunityIcons name="meditation" size={size} color={color} />,
    brain: <MaterialCommunityIcons name="brain" size={size} color={color} />,
    workout: <Ionicons name="barbell" size={size} color={color} />,
    chart: <Ionicons name="analytics" size={size} color={color} />,
    settings: <Ionicons name="settings" size={size} color={color} />,
    plus: <Ionicons name="add" size={size} color={color} />,
    'chevron-right': <Ionicons name="chevron-forward" size={size} color={color} />,
    'chevron-left': <Ionicons name="chevron-back" size={size} color={color} />,
    'chevron-down': <Ionicons name="chevron-down" size={size} color={color} />,
    check: <Ionicons name="checkmark" size={size} color={color} />,
    close: <Ionicons name="close" size={size} color={color} />,
    fire: <Ionicons name="flame" size={size} color={color} />,
    award: <Ionicons name="trophy" size={size} color={color} />,
    target: <Ionicons name="radio-button-on" size={size} color={color} />,
    'trending-up': <Feather name="trending-up" size={size} color={color} />,
    'trending-down': <Feather name="trending-down" size={size} color={color} />,
    calendar: <Ionicons name="calendar" size={size} color={color} />,
    clock: <Ionicons name="time" size={size} color={color} />,
    refresh: <Ionicons name="refresh" size={size} color={color} />,
    edit: <Feather name="edit-3" size={size} color={color} />,
    trash: <Feather name="trash-2" size={size} color={color} />,
    lock: <Ionicons name="lock-closed" size={size} color={color} />,
    bell: <Ionicons name="notifications" size={size} color={color} />,
    heart: <Ionicons name="heart" size={size} color={color} />,
    energy: <Ionicons name="flash" size={size} color={color} />,
  };

  return iconMap[name] || null;
}
