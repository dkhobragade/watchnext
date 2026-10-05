import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import { getSetting, setSetting } from './db';

export type ThemeMode = 'light' | 'dark';

export interface ThemeColors
{
  background: string;
  card: string;
  text: string;
  subtext: string;
  border: string;
  accent: string;
  success: string;
}

export const darkColors: ThemeColors = {
  background: '#111',
  card: '#1c1c1e',
  text: '#fff',
  subtext: '#aaa',
  border: '#333',
  accent: '#e50914',
  success: '#2ecc71',
};

export const lightColors: ThemeColors = {
  background: '#f5f5f7',
  card: '#ffffff',
  text: '#111',
  subtext: '#666',
  border: '#ddd',
  accent: '#e50914',
  success: '#2ecc71',
};

export interface ThemeContextValue
{
  colors: ThemeColors;
  mode: ThemeMode;
  setMode: ( mode: ThemeMode ) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>( undefined );

export function ThemeProvider ( { children }: { children: ReactNode } )
{
  const [ mode, setModeState ] = useState<ThemeMode>( () =>
  {
    try
    {
      const saved = getSetting( 'theme_mode', 'light' );
      if ( saved === 'light' || saved === 'dark' )
      {
        return saved;
      }
    } catch
    {
      // Fallback if settings table query fails
    }
    return 'light';
  } );

  const setMode = useCallback( ( newMode: ThemeMode ) =>
  {
    setModeState( newMode );
    try
    {
      setSetting( 'theme_mode', newMode );
    } catch
    {
      // Ignore write errors
    }
  }, [] );

  const isDark = useMemo( () => mode === 'dark', [ mode ] );

  const colors = useMemo( () =>
  {
    return isDark ? darkColors : lightColors;
  }, [ isDark ] );

  const contextValue = useMemo(
    () => ( {
      colors,
      mode,
      setMode,
      isDark,
    } ),
    [ colors, mode, setMode, isDark ]
  );

  return (
    <ThemeContext.Provider value={ contextValue }>
      { children }
    </ThemeContext.Provider>
  );
}

export function useTheme (): ThemeContextValue
{
  const context = useContext( ThemeContext );
  if ( !context )
  {
    throw new Error( 'useTheme must be used within a ThemeProvider' );
  }
  return context;
}
