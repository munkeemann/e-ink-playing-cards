import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import { loadSettings, syncSleeveCountFromPi } from '../src/storage/deckStorage';
import { configurePiDebug } from '../src/api/piServer';
import { ThemeProvider, useTheme } from '../src/theme/colors';
import TomeBackground from '../src/components/TomeBackground';

function StackWithTheme() {
  const colors = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg.surface },
        headerTintColor: colors.accent.primary,
        headerTitleStyle: { fontWeight: 'bold', color: colors.text.primary },
        contentStyle: { backgroundColor: 'transparent' },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="mtg/index"
        options={{ title: 'MTG Deck Manager' }}
      />
      <Stack.Screen
        name="coming-soon"
        options={{ title: '' }}
      />
      <Stack.Screen
        name="holdem/setup"
        options={{ title: "Texas Hold'em" }}
      />
      <Stack.Screen
        name="holdem/game"
        options={{ title: "Texas Hold'em" }}
      />
      <Stack.Screen
        name="cah/setup"
        options={{ title: 'Cards Against Humanity' }}
      />
      <Stack.Screen
        name="cah/game"
        options={{ title: 'Cards Against Humanity' }}
      />
      <Stack.Screen
        name="cah/game_maxs"
        options={{ title: "CAH — Max's Rules" }}
      />
      <Stack.Screen
        name="dnd/index"
        options={{ title: 'D&D Decks' }}
      />
      <Stack.Screen
        name="dnd/new"
        options={{ title: 'New D&D Deck' }}
      />
      <Stack.Screen
        name="dnd/[id]"
        options={{ title: 'Deck' }}
      />
      <Stack.Screen name="import" options={{ title: 'Import Deck' }} />
      <Stack.Screen name="deck/[id]" options={{ title: 'Deck Preview' }} />
      <Stack.Screen name="game/[id]" options={{ title: 'In Game' }} />
      <Stack.Screen name="scry" options={{ title: 'Scry' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    loadSettings().then(s => configurePiDebug(s.devMode && s.piDebugAlerts));
    syncSleeveCountFromPi().catch(e => console.warn('[settings] sleeveCount sync failed:', e));
  }, []);

  return (
    <GestureHandlerRootView style={rootStyles.root}>
      <ThemeProvider>
        <TomeBackground />
        <StackWithTheme />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const rootStyles = StyleSheet.create({
  root: { flex: 1 },
});
