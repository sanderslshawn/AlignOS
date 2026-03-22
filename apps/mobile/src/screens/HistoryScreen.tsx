import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ScheduleItem, DayPlan } from '@physiology-engine/shared';
import { format, parseISO } from 'date-fns';
import { useTheme, Card, AppIcon } from '@physiology-engine/ui';
import { sortScheduleItems } from '../utils/scheduleSort';
import { clockTimeFromISO, formatClockTime } from '../utils/clockTime';

const iconByType: Record<string, any> = {
  wake: 'sunrise',
  sleep: 'sleep',
  work: 'work',
  meal: 'meal',
  lunch: 'meal',
  snack: 'snack',
  workout: 'workout',
  walk: 'walk',
  focus: 'focus',
  break: 'break',
  meeting: 'meeting',
  hydration: 'water',
  stretch: 'stretch',
  winddown: 'winddown',
  commute: 'calendar',
  recovery: 'calendar',
  caffeine: 'calendar',
  custom: 'calendar',
};

export default function HistoryScreen({ route, navigation }: any) {
  const { colors, typography, spacing, radius } = useTheme();
  const dateISO = route?.params?.dateISO || format(new Date(), 'yyyy-MM-dd');

  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadHistory() {
      try {
        setLoading(true);

        const todayEntriesJson = await AsyncStorage.getItem(`todayEntries_${dateISO}`);
        const fullDayPlanJson = await AsyncStorage.getItem(`fullDayPlan_${dateISO}`);

        let resolvedItems: ScheduleItem[] = [];

        if (todayEntriesJson) {
          const parsedEntries = JSON.parse(todayEntriesJson) as ScheduleItem[];
          resolvedItems = parsedEntries.filter((item) => item.notes !== 'deleted-marker');
        } else if (fullDayPlanJson) {
          const parsedPlan = JSON.parse(fullDayPlanJson) as DayPlan;
          resolvedItems = (parsedPlan.items || []).filter((item) => item.notes !== 'deleted-marker');
        }

        if (mounted) {
          setItems(sortScheduleItems(resolvedItems));
        }
      } catch (error) {
        console.warn('[HistoryScreen] Failed to load history', error);
        if (mounted) {
          setItems([]);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadHistory();

    return () => {
      mounted = false;
    };
  }, [dateISO]);

  const title = useMemo(() => {
    try {
      return format(parseISO(`${dateISO}T00:00:00`), 'EEEE, MMM d');
    } catch {
      return dateISO;
    }
  }, [dateISO]);

  const renderItem = (item: ScheduleItem) => {
    const startClock = item.startTime || clockTimeFromISO(item.startISO);
    const endClock = item.endTime || clockTimeFromISO(item.endISO);
    const startLabel = startClock ? formatClockTime(startClock) : '';
    const endLabel = endClock ? formatClockTime(endClock) : '';

    const statusLabel =
      item.status === 'actual' || item.origin === 'actual'
        ? 'Completed'
        : item.status === 'skipped'
          ? 'Skipped'
          : item.status === 'adjusted'
            ? 'Adjusted'
            : 'Scheduled';

    return (
      <View
        key={item.id}
        style={[
          styles.itemRow,
          {
            borderColor: colors.borderSubtle,
            backgroundColor: colors.surfaceElevated,
          },
        ]}
      >
        <View style={styles.timeCol}>
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            {startLabel}{endLabel ? ` - ${endLabel}` : ''}
          </Text>
        </View>

        <View style={styles.bodyCol}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <AppIcon name={iconByType[item.type] || 'calendar'} size={14} color={colors.textSecondary} />
            <Text
              style={[
                typography.bodyM,
                { color: colors.textPrimary, marginLeft: spacing.xs, fontWeight: '600' },
              ]}
            >
              {item.title}
            </Text>
          </View>

          <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
            {statusLabel}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={[typography.titleL, { color: colors.textPrimary }]}>History</Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>{title}</Text>
          </View>

          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={[typography.caption, { color: colors.accentPrimary }]}>Back</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: spacing['2xl'] }}>
        <View style={{ padding: spacing.lg }}>
          <Card>
            <Text style={[typography.bodyM, { color: colors.textPrimary, fontWeight: '700' }]}>
              Finalized Schedule
            </Text>
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.xs }]}>
              This shows the saved schedule for the selected day, including the changes made that day.
            </Text>
          </Card>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator />
          </View>
        ) : items.length === 0 ? (
          <View style={{ paddingHorizontal: spacing.lg }}>
            <Card>
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                No saved schedule found for this day.
              </Text>
            </Card>
          </View>
        ) : (
          <View style={{ paddingHorizontal: spacing.lg }}>
            {items.map(renderItem)}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  scroll: { flex: 1 },
  itemRow: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  timeCol: {
    width: 110,
    paddingRight: 8,
  },
  bodyCol: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 32,
  },
});