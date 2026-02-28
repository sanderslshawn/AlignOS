# Physiology-First Structure Engine

A real-time physiology-inspired decision engine that generates optimal daily structure schedules based on timing, fasting windows, meal types, caffeine timing, activation routines, walking routines, HR targets, sleep quality, stress level, and real-time constraints.

This is **NOT** a calorie tracking app, macro app, or food logging app. It's a coach that recalculates your day instantly based on your physiological state.

## Architecture

This is a monorepo containing:

- **apps/mobile** - Expo React Native mobile application
- **packages/engine** - Pure deterministic rule engine (TypeScript)
- **packages/shared** - Shared types and utilities
- **packages/ui** - Reusable UI components

## Tech Stack

- TypeScript
- Expo React Native
- Zustand (state management)
- date-fns (time calculations)
- zod (schema validation)
- React Navigation
- AsyncStorage (persistence)

## Setup Instructions

### Prerequisites

- Node.js 18+ 
- npm 9+
- Expo CLI

### Installation

```bash
# Install all dependencies
npm install

# Start the development server
npm run dev
```

**IMPORTANT:** Always run Expo commands from the `apps/mobile` directory, not from the workspace root:
```bash
# ✅ Correct
cd apps/mobile
npx expo start

# ❌ Wrong - will cause TypeScript config errors
npx expo start  # from root directory
```

**Note:** The app uses placeholder text files for icon/splash assets. Expo will show warnings about these, but the app will still run. Replace the placeholder files in `apps/mobile/assets/` with actual PNG images for production.

### Running the App

After running `npm run dev`, you can:

- Press `i` to open iOS simulator
- Press `a` to open Android emulator
- Scan QR code with Expo Go app on your physical device

## Project Structure

```
/
├── apps/
│   └── mobile/              # Expo React Native app
│       ├── src/
│       │   ├── screens/     # App screens
│       │   ├── navigation/  # Navigation setup
│       │   ├── store/       # Zustand stores
│       │   └── components/  # UI components
├── packages/
│   ├── engine/              # Core decision engine
│   │   ├── src/
│   │   │   ├── generatePlan.ts
│   │   │   ├── modules/     # Engine modules
│   │   │   └── utils/       # Helper utilities
│   ├── shared/              # Shared types and schemas
│   └── ui/                  # Reusable components
└── docs/                    # Documentation
```

## Engine Features

The engine implements:

1. **Day Mode Selector** - tight, flex, recovery, high-output, low-output
2. **Meal Classification** - lean protein, richer protein, carb-heavy, comfort meal
3. **Fasting Window Logic** - intelligent fasting window management
4. **Meal Sequencing** - protein-first, carb-last strategies
5. **Caffeine Timing** - spacing rules, sleep cutoff, stress/HR adjustment
6. **Walk Placement** - post-meal windows, HR zone targeting
7. **Activation Routines** - pre-walk, pre-meal, midday reset, night routine
8. **Comfort Meal Containment** - defined sequences with no judgment
9. **Sleep Optimization** - protect sleep quality
10. **Hydration Structure** - intelligent hydration timing
11. **Timeline Builder** - constraint-aware scheduling
12. **Candidate Generation** - multiple schedule variants
13. **Scoring Engine** - feasibility, consistency, metabolic structure
14. **Plan Diff Generator** - shows what changed

## Demo Scenarios

The app includes 3 built-in demo states:

1. **Tight Day** - highly structured day with minimal flexibility
2. **Comfort Meal Day** - includes a comfort meal with containment
3. **Recovery Day** - lower intensity, focus on recovery

## Development

```bash
# Run tests
npm run test

# Type check
npm run type-check

# Build all packages
npm run build

# Clean all node_modules
npm run clean
```

## License

MIT
