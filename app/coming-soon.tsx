import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import TomePageFrame from '../src/components/TomePageFrame';
import { Theme, useTheme } from '../src/theme/colors';
import { fonts } from '../src/theme/fonts';

export default function ComingSoonScreen() {
  const { game } = useLocalSearchParams<{ game: string }>();
  const colors = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <TomePageFrame>
      <View style={styles.center}>
        <Text style={styles.icon}>🔮</Text>
        <Text style={styles.title}>{game ?? 'Coming Soon'}</Text>
        <Text style={styles.subtitle}>Coming soon</Text>
      </View>
    </TomePageFrame>
  );
}

function makeStyles(colors: Theme) {
  return StyleSheet.create({
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    icon: { fontSize: 48, marginBottom: 8 },
    title: {
      color: colors.text.ink,
      fontFamily: fonts.displayBold,
      fontSize: 22,
      letterSpacing: 1,
      textAlign: 'center',
      paddingHorizontal: 24,
    },
    subtitle: {
      color: colors.text.inkSoft,
      fontFamily: fonts.body,
      fontSize: 15,
      letterSpacing: 0.5,
    },
  });
}
