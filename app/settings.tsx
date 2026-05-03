import { useCallback, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { loadSettings, saveSettings, syncSleeveCountFromPi } from '../src/storage/deckStorage';
import { configurePiDebug } from '../src/api/piServer';
import { AppSettings } from '../src/types';
import { Theme, useTheme } from '../src/theme/colors';
import { fonts } from '../src/theme/fonts';
import TomePageFrame from '../src/components/TomePageFrame';
import { Button, Section, Stepper, Switch } from '../src/components/parchment';

const ZONE_OPTIONS: { id: string; label: string; note?: string }[] = [
  { id: 'LIB',   label: 'Library (top card)' },
  { id: 'HND',   label: 'Hand' },
  { id: 'BTFLD', label: 'Battlefield' },
  { id: 'GRV',   label: 'Graveyard', note: 'virtual by default' },
  { id: 'EXL',   label: 'Exile',     note: 'virtual by default' },
];

export default function SettingsScreen() {
  const colors = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [settings, setSettings] = useState<AppSettings>({
    sleeveCount: 5,
    physicalZones: ['LIB', 'HND', 'BTFLD'],
    librarySleeveDepth: 1,
    devMode: false,
    piDebugAlerts: false,
    theme: 'arcane',
  });
  useFocusEffect(
    useCallback(() => {
      loadSettings().then(setSettings);
      syncSleeveCountFromPi().then(setSettings);
    }, []),
  );

  const setSleeveCount = (next: number) =>
    setSettings(prev => ({ ...prev, sleeveCount: next }));

  const setLibraryDepth = (next: number) =>
    setSettings(prev => ({ ...prev, librarySleeveDepth: next }));

  const toggleZone = (zoneId: string) => {
    setSettings(prev => {
      const has = prev.physicalZones.includes(zoneId);
      return {
        ...prev,
        physicalZones: has
          ? prev.physicalZones.filter(z => z !== zoneId)
          : [...prev.physicalZones, zoneId],
      };
    });
  };

  const handleSave = async () => {
    await saveSettings({ ...settings, theme: 'arcane' });
    configurePiDebug(settings.devMode && settings.piDebugAlerts);
    router.back();
  };

  const remainingSleeves = settings.sleeveCount - 1;

  return (
    <TomePageFrame>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Section title="Physical Sleeves">
          <View style={styles.row}>
            <View style={styles.rowLabelCol}>
              <Text style={styles.labelText}>Sleeve count</Text>
            </View>
            <Stepper value={settings.sleeveCount} min={1} max={60} onChange={setSleeveCount} />
          </View>
          <View style={[styles.row, styles.rowDivider]}>
            <View style={styles.rowLabelCol}>
              <Text style={styles.labelText}>Library depth (sleeves)</Text>
              <Text style={styles.subLabelText}>
                How many top-of-library cards get a physical sleeve
              </Text>
            </View>
            <Stepper
              value={settings.librarySleeveDepth ?? 1}
              min={1}
              max={10}
              onChange={setLibraryDepth}
            />
          </View>
        </Section>
        <Text style={styles.trailingHint}>
          Commander always occupies sleeve 1. Remaining {remainingSleeves} sleeve
          {remainingSleeves !== 1 ? 's' : ''} are filled from physical zones below.
        </Text>

        <Section
          title="Physical Zones"
          hint="Cards in physical zones are pushed to sleeves. Cards in virtual zones are tracked in the app only."
        >
          {ZONE_OPTIONS.map((zone, i) => (
            <View key={zone.id} style={[styles.row, i > 0 && styles.rowDivider]}>
              <View style={styles.rowLabelCol}>
                <Text style={styles.labelText}>{zone.label}</Text>
                {zone.note && <Text style={styles.subLabelText}>{zone.note}</Text>}
              </View>
              <Switch
                value={settings.physicalZones.includes(zone.id)}
                onValueChange={() => toggleZone(zone.id)}
              />
            </View>
          ))}
        </Section>

        <Section title="Developer">
          <View style={styles.row}>
            <View style={styles.rowLabelCol}>
              <Text style={styles.labelText}>Dev Mode</Text>
              <Text style={styles.subLabelText}>Reveals hidden game information</Text>
            </View>
            <Switch
              value={settings.devMode}
              onValueChange={v =>
                setSettings(prev => ({
                  ...prev,
                  devMode: v,
                  piDebugAlerts: v ? prev.piDebugAlerts : false,
                }))
              }
            />
          </View>
          {settings.devMode && (
            <View style={[styles.row, styles.rowDivider]}>
              <View style={styles.rowLabelCol}>
                <Text style={styles.labelText}>Pi Debug Alerts</Text>
                <Text style={styles.subLabelText}>
                  Show blocking step-by-step alerts for all Pi network calls
                </Text>
              </View>
              <Switch
                value={settings.piDebugAlerts}
                onValueChange={v =>
                  setSettings(prev => ({ ...prev, piDebugAlerts: v }))
                }
              />
            </View>
          )}
        </Section>
      </ScrollView>

      <View style={styles.saveWrap}>
        <Button onPress={handleSave}>Save Settings</Button>
      </View>
    </TomePageFrame>
  );
}

function makeStyles(colors: Theme) {
  return StyleSheet.create({
    scroll: { flex: 1 },
    scrollContent: { paddingBottom: 12 },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    rowDivider: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.text.inkSoft,
    },
    rowLabelCol: { flex: 1, marginRight: 12 },
    labelText: {
      color: colors.text.ink,
      fontFamily: fonts.body,
      fontSize: 16,
    },
    subLabelText: {
      color: colors.text.inkSoft,
      fontSize: 12,
      marginTop: 2,
      lineHeight: 16,
    },

    trailingHint: {
      color: colors.text.inkSoft,
      fontSize: 12,
      lineHeight: 18,
      marginTop: 8,
      marginBottom: 24,
    },

    saveWrap: { marginTop: 8 },
  });
}
