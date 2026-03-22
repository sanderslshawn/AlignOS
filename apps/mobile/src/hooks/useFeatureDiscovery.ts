import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@alignos/feature-discovery-levels';

type FeatureLevels = Record<string, number>;

export function useFeatureDiscovery(featureKey: string, maxLevel = 3) {
  const [levels, setLevels] = useState<FeatureLevels>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!active) return;
        if (!raw) {
          setLevels({});
        } else {
          setLevels(JSON.parse(raw) as FeatureLevels);
        }
      } catch {
        if (active) setLevels({});
      } finally {
        if (active) setReady(true);
      }
    };

    load();

    return () => {
      active = false;
    };
  }, []);

  const currentLevel = useMemo(() => levels[featureKey] ?? 0, [featureKey, levels]);

  const persist = useCallback(
    async (next: FeatureLevels) => {
      setLevels(next);
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
      }
    },
    []
  );

  const advanceLevel = useCallback(async () => {
    const current = levels[featureKey] ?? 0;
    const nextLevel = Math.min(maxLevel, current + 1);
    if (nextLevel === current) return;
    const next = { ...levels, [featureKey]: nextLevel };
    await persist(next);
  }, [featureKey, levels, maxLevel, persist]);

  const resetLevel = useCallback(async () => {
    const next = { ...levels, [featureKey]: 0 };
    await persist(next);
  }, [featureKey, levels, persist]);

  const shouldShow = useCallback(
    (targetLevel: number) => {
      if (!ready) return false;
      return currentLevel < targetLevel;
    },
    [currentLevel, ready]
  );

  return {
    ready,
    currentLevel,
    shouldShow,
    advanceLevel,
    resetLevel,
  };
}
