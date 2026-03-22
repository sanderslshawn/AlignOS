import type { DietFoundation, MealCategory, DayMode } from '@physiology-engine/shared';

/**
 * DIET FOUNDATION MEAL TEMPLATES
 * Provides structure-based meal guidance (NOT nutrition tracking).
 * Templates describe meal composition and approach, not calories/macros.
 */

export interface MealTemplate {
  label: string;
  instructions: string[];
  emphasis: string;
}

/**
 * Get meal template based on diet foundation, meal category, and day mode.
 * Manual edits always override these templates.
 */
export function getMealTemplate(
  dietFoundation: DietFoundation,
  category: MealCategory,
  mode: DayMode
): MealTemplate {
  // Handle comfort meals specially (never mixed with protected anchor meal)
  if (category === 'COMFORT') {
    return getComfortMealTemplate(dietFoundation);
  }
  
  // For protected anchor meal (Meal 2): always clean, structure-focused
  if (category === 'LEAN') {
    return getLeanMealTemplate(dietFoundation, mode);
  }
  
  if (category === 'RICHER') {
    return getRicherMealTemplate(dietFoundation, mode);
  }
  
  return getNeutralMealTemplate(dietFoundation, mode);
}

function getLeanMealTemplate(foundation: DietFoundation, mode: DayMode): MealTemplate {
  const templates: Record<DietFoundation, MealTemplate> = {
    BALANCED: {
      label: 'Balanced Clean Plate',
      instructions: [
        'Lean protein + fibrous vegetables',
        'Simple preparation, minimal processing',
        'Focus on structure and steady energy',
      ],
      emphasis: 'Protected anchor meal - maintains metabolic structure',
    },
    KETO: {
      label: 'Keto Clean Plate',
      instructions: [
        'Protein + non-starchy vegetables + quality fats',
        'Avoid sweet treats here',
        'Keep it simple and clean',
      ],
      emphasis: 'Protected anchor - preserves ketogenic structure',
    },
    CARNIVORE: {
      label: 'Carnivore Anchor',
      instructions: [
        'Protein-forward simple plate',
        'Minimal ingredients',
        'Focus on quality and simplicity',
      ],
      emphasis: 'Protected anchor - meat-based foundation',
    },
    MEDITERRANEAN: {
      label: 'Mediterranean Clean',
      instructions: [
        'Lean protein + vegetables + olive oil style',
        'Simple whole foods',
        'Traditional preparation',
      ],
      emphasis: 'Protected anchor - Mediterranean structure',
    },
    LOW_CALORIE: {
      label: 'Lighter Clean Plate',
      instructions: [
        'Lean protein + high-volume vegetables',
        'Simpler portioning approach',
        'Focus on satiety with structure',
      ],
      emphasis: 'Protected anchor - lighter approach, maintains structure',
    },
    LOW_FAT: {
      label: 'Leaner Choices Plate',
      instructions: [
        'Lean protein selections',
        'Vegetables with minimal added fats',
        'Keep meal simple',
      ],
      emphasis: 'Protected anchor - leaner composition',
    },
    LOW_CARB: {
      label: 'Low-Carb Clean',
      instructions: [
        'Protein + non-starchy vegetables',
        'Simple and structured',
        'Avoid starchy additions',
      ],
      emphasis: 'Protected anchor - lower carb structure',
    },
    HIGH_PROTEIN: {
      label: 'Protein-Forward Clean',
      instructions: [
        'Higher protein portion + vegetables',
        'Simple preparation',
        'Focus on protein quality',
      ],
      emphasis: 'Protected anchor - protein-emphasized structure',
    },
  };
  
  return templates[foundation];
}

function getRicherMealTemplate(foundation: DietFoundation, mode: DayMode): MealTemplate {
  const templates: Record<DietFoundation, MealTemplate> = {
    BALANCED: {
      label: 'Balanced Fuller Plate',
      instructions: [
        'Protein + vegetables + quality fats or starch',
        'More variety in preparation',
        'Still structured, just fuller',
      ],
      emphasis: 'Richer meal - more variety, maintains structure',
    },
    KETO: {
      label: 'Keto Fuller Plate',
      instructions: [
        'Protein + vegetables + generous healthy fats',
        'Cheese, oils, nuts acceptable here',
        'Keep carbs minimal',
      ],
      emphasis: 'Richer keto meal - more fats, still low-carb',
    },
    CARNIVORE: {
      label: 'Carnivore Fuller',
      instructions: [
        'Fattier cuts or larger portion',
        'Eggs, cheese if tolerated',
        'Still protein-focused',
      ],
      emphasis: 'Richer carnivore - fattier selections',
    },
    MEDITERRANEAN: {
      label: 'Mediterranean Fuller',
      instructions: [
        'Protein + vegetables + olive oil + olives/nuts',
        'More traditional variety',
        'Whole food ingredients',
      ],
      emphasis: 'Richer Mediterranean - more variety, stays whole-food',
    },
    LOW_CALORIE: {
      label: 'Moderate Plate',
      instructions: [
        'Protein + vegetables with normal portioning',
        'Less restriction here',
        'Balanced approach',
      ],
      emphasis: 'Moderate meal - relaxed portioning within structure',
    },
    LOW_FAT: {
      label: 'Lean with Carbs',
      instructions: [
        'Lean protein + vegetables + starch option',
        'Minimal added fats',
        'Simple carb additions acceptable',
      ],
      emphasis: 'Richer low-fat - includes starchy additions',
    },
    LOW_CARB: {
      label: 'Low-Carb Richer',
      instructions: [
        'Protein + vegetables + more fats',
        'Still avoiding starches',
        'Generous fat additions',
      ],
      emphasis: 'Richer low-carb - higher fat, still low carb',
    },
    HIGH_PROTEIN: {
      label: 'Protein-Rich Fuller',
      instructions: [
        'Large protein portion + vegetables + fat or starch',
        'More variety',
        'High protein maintained',
      ],
      emphasis: 'Richer high-protein - stays protein-forward',
    },
  };
  
  return templates[foundation];
}

function getComfortMealTemplate(foundation: DietFoundation): MealTemplate {
  const templates: Record<DietFoundation, MealTemplate> = {
    BALANCED: {
      label: 'Comfort Window Meal',
      instructions: [
        'Social or treat meal within designated window',
        'Enjoy the moment, then close window',
        'Flush walk suggested after',
      ],
      emphasis: 'Comfort slot - window closes after this',
    },
    KETO: {
      label: 'Keto Comfort Window',
      instructions: [
        'Comfort meal within designated window',
        'Try to keep lower-carb if possible',
        'Window closes after - no stacking',
      ],
      emphasis: 'Comfort slot - window closes after, avoid stacking treats',
    },
    CARNIVORE: {
      label: 'Carnivore Comfort',
      instructions: [
        'Social meat-based meal or treat',
        'Enjoy within window',
        'Return to baseline after',
      ],
      emphasis: 'Comfort slot - window closes, return to simple after',
    },
    MEDITERRANEAN: {
      label: 'Mediterranean Social',
      instructions: [
        'Social meal or treat within window',
        'Traditional comfort foods acceptable',
        'Close window after',
      ],
      emphasis: 'Comfort slot - enjoy, then close window',
    },
    LOW_CALORIE: {
      label: 'Treat Window',
      instructions: [
        'Treat or social meal in designated window',
        'Enjoy without guilt',
        'Simpler meals resume after',
      ],
      emphasis: 'Comfort slot - window closes to preserve momentum',
    },
    LOW_FAT: {
      label: 'Low-Fat Comfort Window',
      instructions: [
        'Social or treat meal',
        'May include higher-fat comfort foods',
        'Window closes after',
      ],
      emphasis: 'Comfort slot - occasional higher-fat, window closes after',
    },
    LOW_CARB: {
      label: 'Low-Carb Comfort',
      instructions: [
        'Comfort meal within window',
        'May include carbs if social',
        'Return to low-carb structure after',
      ],
      emphasis: 'Comfort slot - window closes, back to low-carb after',
    },
    HIGH_PROTEIN: {
      label: 'Protein Comfort',
      instructions: [
        'Social or comfort meal',
        'Try to include protein if possible',
        'Window closes after',
      ],
      emphasis: 'Comfort slot - enjoy, return to high-protein after',
    },
  };
  
  return templates[foundation];
}

function getNeutralMealTemplate(foundation: DietFoundation, mode: DayMode): MealTemplate {
  return {
    label: 'Standard Meal',
    instructions: [
      'Follow your foundation approach',
      'Keep it simple and consistent',
    ],
    emphasis: 'Standard meal - maintains your chosen foundation',
  };
}

/**
 * Apply meal template to event (adds template label and category)
 */
export function applyMealTemplate(
  mealEvent: any,
  category: MealCategory,
  dietFoundation: DietFoundation,
  mode: DayMode
): any {
  const template = getMealTemplate(dietFoundation, category, mode);
  
  return {
    ...mealEvent,
    meal: {
      category,
      template: template.label,
    },
    description: template.emphasis,
  };
}
