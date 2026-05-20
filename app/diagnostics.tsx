/**
 * Diagnostics — sleeve registry + identify/clear actions.
 *
 * Two-phase parallel push pattern (same as CAH pushUpdates / MTG beginGame):
 *   Phase A — serial capture: drive the off-screen IdentifyCard once per
 *             sleeve to bake a per-id JPEG. Concurrent captures aren't
 *             safe (single renderer).
 *   Phase B — parallel send: hand the prepared images to
 *             identifyAllSleeves(), which fans out under PI_CONCURRENCY.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  SleeveRegistryEntry,
  clearAllSleeves,
  clearSleeve,
  getSleeveRegistry,
  identifyAllSleeves,
  identifySleeve,
} from '../src/api/piServer';
import IdentifyCard, { IdentifyCardRef } from '../src/shared/IdentifyCard';
import TomePageFrame from '../src/components/TomePageFrame';
import { Button, Fleuron, Section } from '../src/components/parchment';
import { Theme, useTheme } from '../src/theme/colors';
import { fonts } from '../src/theme/fonts';

const CAPTURE_TIMEOUT_MS = 3000;

function captureWithTimeout(p: Promise<ArrayBuffer>): Promise<ArrayBuffer> {
  return Promise.race([
    p,
    new Promise<ArrayBuffer>((_, reject) =>
      setTimeout(() => reject(new Error('capture timed out')), CAPTURE_TIMEOUT_MS),
    ),
  ]);
}

function computeGaps(registry: SleeveRegistryEntry[]): number[] {
  if (registry.length === 0) return [];
  const present = new Set(registry.map(e => e.id));
  const max = Math.max(...registry.map(e => e.id));
  const gaps: number[] = [];
  for (let i = 1; i <= max; i++) if (!present.has(i)) gaps.push(i);
  return gaps;
}

function fmtDuration(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

type StatusLine = { ts: number; text: string } | null;

export default function DiagnosticsScreen() {
  const colors = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [registry, setRegistry] = useState<SleeveRegistryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState<null | 'identifyAll' | 'clearAll'>(null);
  const [progress, setProgress] = useState({ sent: 0, total: 0 });
  const [status, setStatus] = useState<StatusLine>(null);
  const rendererRef = useRef<IdentifyCardRef>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getSleeveRegistry();
      setRegistry(r);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
      return () => {
        // Clear transient status on unmount so the next visit starts fresh.
        setStatus(null);
      };
    }, [refresh]),
  );

  const gaps = useMemo(() => computeGaps(registry), [registry]);

  const subtitleText = registry.length === 0
    ? 'No sleeves registered. Make sure the Pi is reachable on E-ink Wi-Fi.'
    : `${registry.length} sleeve${registry.length === 1 ? '' : 's'} registered`
      + (gaps.length > 0 ? `  ·  missing: ${gaps.join(', ')}` : '');

  // Phase-A helper: capture per-id images sequentially. Returns only the
  // entries whose capture succeeded; failures get logged and surface in
  // the final status footer via the count delta.
  const captureAll = async (
    entries: SleeveRegistryEntry[],
  ): Promise<Array<{ id: number; imageData: ArrayBuffer }>> => {
    const prepared: Array<{ id: number; imageData: ArrayBuffer }> = [];
    for (const e of entries) {
      if (!rendererRef.current) break;
      try {
        const imageData = await captureWithTimeout(rendererRef.current.capture(e.id, e.ip));
        prepared.push({ id: e.id, imageData });
      } catch (err) {
        console.warn(`[DIAG] capture sleeve ${e.id} failed:`, err instanceof Error ? err.message : err);
      }
    }
    return prepared;
  };

  const handleIdentifyOne = async (entry: SleeveRegistryEntry) => {
    if (running) return;
    if (!rendererRef.current) return;
    try {
      const imageData = await captureWithTimeout(rendererRef.current.capture(entry.id, entry.ip));
      const t0 = Date.now();
      await identifySleeve(entry.id, imageData);
      setStatus({ ts: Date.now(), text: `Identify sleeve ${entry.id}: OK · ${fmtDuration(Date.now() - t0)}` });
    } catch (e) {
      setStatus({ ts: Date.now(), text: `Identify sleeve ${entry.id}: ${e instanceof Error ? e.message : String(e)}` });
    }
  };

  const handleClearOne = async (entry: SleeveRegistryEntry) => {
    if (running) return;
    const t0 = Date.now();
    await clearSleeve(entry.id);
    setStatus({ ts: Date.now(), text: `Clear sleeve ${entry.id}: OK · ${fmtDuration(Date.now() - t0)}` });
  };

  const handleIdentifyAll = async () => {
    if (running || registry.length === 0) return;
    setRunning('identifyAll');
    setProgress({ sent: 0, total: registry.length });
    try {
      const prepared = await captureAll(registry);
      const captureFailures = registry.length - prepared.length;
      const result = await identifyAllSleeves(prepared, (sent, total) => setProgress({ sent, total }));
      const failSummary = result.failures.length === 0
        ? (captureFailures > 0 ? ` · ${captureFailures} capture timeout` : '')
        : ` · ${result.failures.length} failed (${result.failures.map(f => f.id).join(', ')})`
          + (captureFailures > 0 ? ` · ${captureFailures} capture timeout` : '');
      setStatus({
        ts: Date.now(),
        text: `Identify All: ${result.ok}/${registry.length} OK${failSummary} · ${fmtDuration(result.durationMs)}`,
      });
    } finally {
      setRunning(null);
      setProgress({ sent: 0, total: 0 });
    }
  };

  const handleClearAll = async () => {
    if (running || registry.length === 0) return;
    setRunning('clearAll');
    setProgress({ sent: 0, total: registry.length });
    try {
      const result = await clearAllSleeves((sent, total) => setProgress({ sent, total }));
      setStatus({
        ts: Date.now(),
        text: `Clear All: ${result.ok}/${result.ok + result.fail} OK · ${fmtDuration(result.durationMs)}`,
      });
    } finally {
      setRunning(null);
      setProgress({ sent: 0, total: 0 });
    }
  };

  const renderRow = ({ item, index }: { item: SleeveRegistryEntry; index: number }) => (
    <View style={[styles.row, index > 0 && styles.rowBorder]}>
      <Text style={styles.rowId}>#{item.id}</Text>
      <Text style={styles.rowIp} numberOfLines={1}>{item.ip || '—'}</Text>
      <Pressable
        style={({ pressed }) => [styles.rowBtn, pressed && styles.rowBtnPressed]}
        onPress={() => handleIdentifyOne(item)}
        disabled={!!running}
      >
        <Text style={styles.rowBtnText}>Identify</Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.rowBtn, pressed && styles.rowBtnPressed]}
        onPress={() => handleClearOne(item)}
        disabled={!!running}
      >
        <Text style={styles.rowBtnText}>Clear</Text>
      </Pressable>
    </View>
  );

  return (
    <TomePageFrame>
      <View style={styles.headerBlock}>
        <Text style={styles.title}>Sleeve Diagnostics</Text>
        <View style={styles.fleuronWrap}><Fleuron width={220} /></View>
      </View>

      <Section
        title="Registry"
        hint={subtitleText}
      >
        <FlatList
          data={registry}
          keyExtractor={e => String(e.id)}
          renderItem={renderRow}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={refresh}
              tintColor={colors.accent.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              {loading
                ? <ActivityIndicator color={colors.accent.primary} />
                : <Text style={styles.emptyText}>Pull to refresh.</Text>}
            </View>
          }
          scrollEnabled
          style={styles.list}
        />
        <View style={styles.refreshRow}>
          <Pressable
            onPress={refresh}
            disabled={loading || !!running}
            style={({ pressed }) => [styles.refreshBtn, pressed && styles.rowBtnPressed]}
          >
            <Text style={styles.refreshBtnText}>↻ Refresh</Text>
          </Pressable>
        </View>
      </Section>

      <Section title="Actions">
        <View style={styles.actionsBody}>
          <Button
            variant="primary"
            disabled={!!running || registry.length === 0}
            onPress={handleIdentifyAll}
          >
            {running === 'identifyAll'
              ? `Identifying ${progress.sent}/${progress.total}…`
              : 'Identify All'}
          </Button>
          <Button
            variant="secondary"
            disabled={!!running || registry.length === 0}
            onPress={handleClearAll}
          >
            {running === 'clearAll'
              ? `Clearing ${progress.sent}/${progress.total}…`
              : 'Clear All'}
          </Button>
        </View>
      </Section>

      {status && (
        <Text style={styles.statusFooter} numberOfLines={3}>{status.text}</Text>
      )}

      <IdentifyCard ref={rendererRef} />
    </TomePageFrame>
  );
}

function makeStyles(colors: Theme) {
  return StyleSheet.create({
    headerBlock: { alignItems: 'center', paddingTop: 4, paddingBottom: 14 },
    title: {
      color: colors.text.ink,
      fontFamily: fonts.displayBold,
      fontSize: 24,
      letterSpacing: 0.5,
    },
    fleuronWrap: { marginTop: 8 },

    list: { maxHeight: 320 },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 4,
      gap: 8,
    },
    rowBorder: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.text.inkSoft,
    },
    rowId: {
      color: colors.accent.dark,
      fontFamily: fonts.displayBold,
      fontSize: 15,
      width: 44,
    },
    rowIp: {
      flex: 1,
      color: colors.text.ink,
      fontFamily: fonts.body,
      fontSize: 13,
    },
    rowBtn: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: colors.accent.primary,
      backgroundColor: colors.bg.parchmentDeep,
    },
    rowBtnPressed: { opacity: 0.85 },
    rowBtnText: {
      color: colors.text.ink,
      fontFamily: fonts.display,
      fontSize: 12,
      letterSpacing: 0.5,
    },

    emptyWrap: { alignItems: 'center', paddingVertical: 24 },
    emptyText: { color: colors.text.inkSoft, fontFamily: fonts.bodyItalic, fontSize: 13 },

    refreshRow: { alignItems: 'flex-end', paddingVertical: 8 },
    refreshBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: colors.accent.dark,
      backgroundColor: colors.bg.parchmentDeep,
    },
    refreshBtnText: {
      color: colors.text.ink,
      fontFamily: fonts.display,
      fontSize: 12,
      letterSpacing: 0.5,
    },

    actionsBody: { paddingVertical: 12, gap: 10 },

    statusFooter: {
      color: colors.text.inkSoft,
      fontFamily: fonts.bodyItalic,
      fontSize: 12,
      lineHeight: 18,
      paddingHorizontal: 4,
      paddingTop: 4,
    },
  });
}
