/**
 * AlignOS Icon System
 * Semantic icon names mapped to vector icons
 */

import { Ionicons } from '@expo/vector-icons';

export const iconMap = {
  // Time & Schedule
  sun: 'sunny-outline',
  moon: 'moon-outline',
  clock: 'time-outline',
  calendar: 'calendar-outline',
  sunrise: 'partly-sunny-outline',
  sunset: 'moon-outline',
  
  // Activity
  walk: 'walk-outline',
  run: 'fitness-outline',
  workout: 'barbell-outline',
  stretch: 'body-outline',
  
  // Nutrition
  meal: 'restaurant-outline',
  snack: 'nutrition-outline',
  water: 'water-outline',
  coffee: 'cafe-outline',
  apple: 'nutrition-outline',
  
  // Work & Focus
  focus: 'eye-outline',
  brain: 'bulb-outline',
  meditation: 'leaf-outline',
  work: 'briefcase-outline',
  meeting: 'people-outline',
  laptop: 'laptop-outline',
  
  // Rest & Recovery
  break: 'cafe-outline',
  winddown: 'moon-outline',
  
  // Status & Actions
  check: 'checkmark-circle-outline',
  checkCircle: 'checkmark-circle',
  plus: 'add-circle-outline',
  plusCircle: 'add-circle',
  info: 'information-circle-outline',
  alert: 'alert-circle-outline',
  trophy: 'trophy-outline',
  star: 'star-outline',
  lock: 'lock-closed-outline',
  
  // Navigation
  home: 'home-outline',
  settings: 'settings-outline',
  chat: 'chatbubble-outline',
  history: 'stats-chart-outline',
  chart: 'analytics-outline',
  back: 'arrow-back',
  forward: 'arrow-forward',
  
  // UI
  chevronRight: 'chevron-forward',
  chevronLeft: 'chevron-back',
  chevronUp: 'chevron-up',
  chevronDown: 'chevron-down',
  close: 'close',
  menu: 'menu-outline',
  more: 'ellipsis-horizontal',
  refresh: 'refresh-outline',
  
  // Biometrics
  heart: 'heart-outline',
  pulse: 'pulse-outline',
  sleep: 'bed-outline',
  
  // Weather & Environment
  cloud: 'cloud-outline',
  thermometer: 'thermometer-outline',
  
  // Social
  people: 'people-outline',
  person: 'person-outline',
  
  // Energy & Performance
  flash: 'flash-outline',
  battery: 'battery-half-outline',
  trending: 'trending-up-outline',
  
  // Misc
  flame: 'flame-outline',
  leaf: 'leaf-outline',
  sparkles: 'sparkles-outline',
  bookmark: 'bookmark-outline',
  location: 'location-outline',
} as const;

export type IconName = keyof typeof iconMap;

// Re-export Ionicons for direct use
export { Ionicons };
