import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useTheme } from '../lib/theme';

function NavigationStack ()
{
  const { colors, isDark } = useTheme();

  return (
    <>
      <StatusBar style={ isDark ? 'light' : 'dark' } />
      <Stack
        screenOptions={ {
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTintColor: colors.text,
          headerTitleStyle: {
            fontWeight: '700',
            fontSize: 18,
            color: colors.text,
          },
          contentStyle: {
            backgroundColor: colors.background,
          },
          headerShadowVisible: false,
        } }
      >
        <Stack.Screen
          name="index"
          options={ {
            title: 'WatchNext',
          } }
        />
        <Stack.Screen
          name="search"
          options={ {
            title: 'Add Movie',
            headerBackTitle: 'Back',
          } }
        />
      </Stack>
    </>
  );
}

export default function RootLayout ()
{
  return (
    <ThemeProvider>
      <NavigationStack />
    </ThemeProvider>
  );
}
