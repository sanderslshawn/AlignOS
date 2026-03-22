import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const LEARN_ALIGNOS_TOUR_KEY = 'hasCompletedLearnAlignOSTour';

export function useTourProgress() {
  const [isReady, setIsReady] = useState(false);
  const [hasCompletedTour, setHasCompletedTour] = useState(false);

  const load = useCallback(async () => {
    try {
      const value = await AsyncStorage.getItem(LEARN_ALIGNOS_TOUR_KEY);
      setHasCompletedTour(value === 'true');
    } catch {
      setHasCompletedTour(false);
    } finally {
      setIsReady(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const markCompleted = useCallback(async () => {
    setHasCompletedTour(true);
    try {
      await AsyncStorage.setItem(LEARN_ALIGNOS_TOUR_KEY, 'true');
    } catch {
    }
  }, []);

  const resetProgress = useCallback(async () => {
    setHasCompletedTour(false);
    try {
      await AsyncStorage.removeItem(LEARN_ALIGNOS_TOUR_KEY);
    } catch {
    }
  }, []);

  return {
    isReady,
    hasCompletedTour,
    markCompleted,
    resetProgress,
    reload: load,
  };
}
