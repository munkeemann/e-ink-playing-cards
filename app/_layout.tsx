import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import {
  Cinzel_400Regular,
  Cinzel_600SemiBold,
  Cinzel_700Bold,
} from '@expo-google-fonts/cinzel';
import {
  EBGaramond_400Regular,
  EBGaramond_400Regular_Italic,
  EBGaramond_700Bold,
} from '@expo-google-fonts/eb-garamond';
import { syncSleeveCountFromPi } from '../src/storage/deckStorage';
import { ThemeProvider, useTheme } from '../src/theme/colors';
import { fonts } from '../src/theme/fonts';
import TomeBackground from '../src/components/TomeBackground';

// Keep the splash screen up at module load so the system font never
// flashes between the launch screen and the first paint with Cinzel /
// EB Garamond loaded. Hidden in RootLayout once useFonts() resolves.
SplashScreen.preventAutoHideAsync().catch(() => {
  /* no-op: splash may already be gone in fast-refresh / dev reloads */
});

function StackWithTheme() {
  const colors = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg.surface },
        headerTintColor: colors.accent.primary,
        headerTitleStyle: { fontFamily: fonts.displayBold, color: colors.text.primary },
        contentStyle: { backgroundColor: 'transparent' },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
          title: 'Home',
          headerBackTitle: 'Home',
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
  const [fontsLoaded] = useFonts({
    Cinzel_400Regular,
    Cinzel_600SemiBold,
    Cinzel_700Bold,
    EBGaramond_400Regular,
    EBGaramond_400Regular_Italic,
    EBGaramond_700Bold,
  });

  useEffect(() => {
    syncSleeveCountFromPi().catch(e => console.warn('[settings] sleeveCount sync failed:', e));
  }, []);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => { /* no-op */ });
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={rootStyles.root}>
      <SafeAreaProvider>
        <ThemeProvider>
          <TomeBackground />
          <StackWithTheme />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const rootStyles = StyleSheet.create({
  root: { flex: 1 },
});
