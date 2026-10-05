import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import
{
  View,
  Text,
  FlatList,
  Image,
  Pressable,
  Alert,
  StyleSheet,
  Animated,
  PanResponder,
} from 'react-native';
import { useRouter, useFocusEffect, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import
{
  MovieRecord,
  getMovies,
  toggleWatched,
  removeMovie,
  restoreMovie,
  updatePlatforms,
} from '../lib/db';
import { getPosterUrl, getProviders } from '../lib/tmdb';
import { useTheme, ThemeColors } from '../lib/theme';

type SwipeableMovieCardProps = {
  movie: MovieRecord;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
  onToggleWatched: ( id: number ) => void;
  onLongPress: ( movie: MovieRecord ) => void;
  onRemove: ( movie: MovieRecord ) => void;
};

function SwipeableMovieCard ( {
  movie,
  colors,
  styles,
  onToggleWatched,
  onLongPress,
  onRemove,
}: SwipeableMovieCardProps )
{
  const translateX = useRef( new Animated.Value( 0 ) ).current;
  const swipeThreshold = 90;
  const maxSwipe = 110;
  const isWatched = movie.watched === 1;
  const posterUrl = getPosterUrl( movie.poster_path );
  const platformDisplay =
    movie.platforms && movie.platforms.trim().length > 0
      ? movie.platforms
      : 'Not on streaming yet';

  const springTo = useCallback( ( toValue: number, onComplete?: () => void ) =>
  {
    Animated.spring( translateX, {
      toValue,
      useNativeDriver: true,
      friction: 9,
      tension: 80,
    } ).start( () => onComplete?.() );
  }, [ translateX ] );

  const panResponder = useMemo(
    () =>
      PanResponder.create( {
        onMoveShouldSetPanResponder: ( _, gestureState ) =>
          Math.abs( gestureState.dx ) > 8 && gestureState.dx < 0,
        onPanResponderGrant: () =>
        {
          translateX.setValue( translateX.__getValue() );
        },
        onPanResponderMove: ( _, gestureState ) =>
        {
          if ( gestureState.dx < 0 )
          {
            const next = Math.max( gestureState.dx, -maxSwipe );
            translateX.setValue( next );
          }
        },
        onPanResponderRelease: ( _, gestureState ) =>
        {
          const shouldDelete = gestureState.dx <= -swipeThreshold;

          if ( shouldDelete )
          {
            springTo( -maxSwipe, () => onRemove( movie ) );
            return;
          }

          springTo( 0 );
        },
        onPanResponderTerminate: () =>
        {
          springTo( 0 );
        },
      } ),
    [ movie, onRemove, springTo, translateX ]
  );

  return (
    <View style={ styles.cardShell }>
      <View style={ [ styles.deleteAction, { backgroundColor: colors.accent } ] }>
        <Text style={ styles.deleteActionText }>Delete</Text>
      </View>

      <Animated.View
        style={ [ styles.cardWrapper, { transform: [ { translateX } ] } ] }
        { ...panResponder.panHandlers }
      >
        <Pressable
          style={ styles.card }
          onLongPress={ () => onLongPress( movie ) }
          delayLongPress={ 400 }
        >
          { posterUrl ? (
            <Image source={ { uri: posterUrl } } style={ styles.poster } />
          ) : (
            <View style={ [ styles.poster, styles.posterPlaceholder ] }>
              <Text style={ styles.placeholderText }>No Poster</Text>
            </View>
          ) }

          <View style={ styles.infoContainer }>
            <Text
              style={ [
                styles.title,
                isWatched ? styles.titleWatched : styles.titleUnwatched,
              ] }
              numberOfLines={ 2 }
            >
              { movie.title }
            </Text>
            <Text
              style={ [
                styles.platforms,
                isWatched && styles.platformsWatched,
                !movie.platforms && styles.noPlatformsText,
              ] }
              numberOfLines={ 2 }
            >
              { platformDisplay }
            </Text>
          </View>

          <Pressable
            style={ [
              styles.checkbox,
              isWatched ? styles.checkboxWatched : styles.checkboxUnwatched,
            ] }
            onPress={ () => onToggleWatched( movie.id ) }
            hitSlop={ 12 }
          >
            { isWatched ? <Text style={ styles.checkmark }>✓</Text> : null }
          </Pressable>
        </Pressable>
      </Animated.View>
    </View>
  );
}

export default function WatchlistScreen ()
{
  const [ movies, setMovies ] = useState<MovieRecord[]>( [] );
  const [ pendingRemoval, setPendingRemoval ] = useState<MovieRecord | null>( null );
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>( null );
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, mode, setMode } = useTheme();

  const cycleMode = useCallback( () =>
  {
    setMode( mode === 'light' ? 'dark' : 'light' );
  }, [ mode, setMode ] );

  useFocusEffect(
    useCallback( () =>
    {
      // 1. Reload from database immediately on screen focus
      const currentList = getMovies();
      setMovies( currentList );

      // 2. Refresh streaming platforms in the background for unwatched movies
      let isMounted = true;

      const refreshBackgroundPlatforms = async () =>
      {
        const unwatched = currentList.filter( ( m ) => m.watched === 0 );
        for ( const movie of unwatched )
        {
          if ( !isMounted ) break;
          try
          {
            const latestPlatforms = await getProviders( movie.id );
            if ( !isMounted ) break;

            if ( latestPlatforms !== movie.platforms )
            {
              updatePlatforms( movie.id, latestPlatforms );
              setMovies( getMovies() );
            }
          } catch
          {
            // Ignore API failures during background refresh
          }
        }
      };

      refreshBackgroundPlatforms();

      return () =>
      {
        isMounted = false;
      };
    }, [] )
  );

  const handleToggleWatched = ( id: number ) =>
  {
    toggleWatched( id );
    setMovies( getMovies() );
  };

  const handleRemoveMovie = useCallback( ( movie: MovieRecord ) =>
  {
    const removedMovie = { ...movie };
    removeMovie( movie.id );
    setMovies( getMovies() );
    setPendingRemoval( removedMovie );

    if ( undoTimeoutRef.current )
    {
      clearTimeout( undoTimeoutRef.current );
    }

    undoTimeoutRef.current = setTimeout( () =>
    {
      setPendingRemoval( null );
      undoTimeoutRef.current = null;
    }, 4000 );
  }, [] );

  const handleUndoRemoval = useCallback( () =>
  {
    if ( !pendingRemoval ) return;

    restoreMovie( pendingRemoval );
    setMovies( getMovies() );
    setPendingRemoval( null );

    if ( undoTimeoutRef.current )
    {
      clearTimeout( undoTimeoutRef.current );
      undoTimeoutRef.current = null;
    }
  }, [ pendingRemoval ] );

  useEffect( () => () =>
  {
    if ( undoTimeoutRef.current )
    {
      clearTimeout( undoTimeoutRef.current );
    }
  }, [] );

  const handleLongPress = ( movie: MovieRecord ) =>
  {
    Alert.alert(
      'Remove Movie',
      `Remove "${ movie.title }" from your watchlist?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => handleRemoveMovie( movie ),
        },
      ]
    );
  };

  const styles = useMemo( () => createStyles( colors ), [ colors ] );

  const renderThemeToggle = () =>
  {
    const label = mode === 'light' ? '☀️ Light' : '🌙 Dark';

    return (
      <Pressable
        onPress={ cycleMode }
        style={ styles.themeToggle }
        hitSlop={ 8 }
        accessibilityRole="button"
        accessibilityLabel={ `Theme mode: ${ mode }. Tap to switch.` }
      >
        <Text style={ styles.themeToggleText }>{ label }</Text>
      </Pressable>
    );
  };

  const renderMovieItem = ( { item }: { item: MovieRecord } ) =>
  {
    return (
      <SwipeableMovieCard
        movie={ item }
        colors={ colors }
        styles={ styles }
        onToggleWatched={ handleToggleWatched }
        onLongPress={ handleLongPress }
        onRemove={ handleRemoveMovie }
      />
    );
  };

  return (
    <View style={ [ styles.container, { paddingBottom: insets.bottom } ] }>
      <Stack.Screen
        options={ {
          headerRight: renderThemeToggle,
        } }
      />

      <FlatList
        data={ movies }
        keyExtractor={ ( item ) => item.id.toString() }
        renderItem={ renderMovieItem }
        contentContainerStyle={ [
          styles.listContent,
          movies.length === 0 && styles.listEmptyContent,
        ] }
        ListEmptyComponent={
          <View style={ styles.emptyContainer }>
            <Text style={ styles.emptyIcon }>🎬</Text>
            <Text style={ styles.emptyTitle }>Your watchlist is empty</Text>
            <Text style={ styles.emptySubtitle }>
              Tap the + button to search and save movies you want to watch.
            </Text>
          </View>
        }
      />

      { pendingRemoval ? (
        <View style={ [ styles.undoBar, { bottom: Math.max( insets.bottom + 88, 92 ) } ] }>
          <Text style={ styles.undoText }>
            Removed "{ pendingRemoval.title }"
          </Text>
          <Pressable
            onPress={ handleUndoRemoval }
            accessibilityRole="button"
            accessibilityLabel="Undo movie removal"
            style={ styles.undoButton }
          >
            <Text style={ styles.undoButtonText }>Undo</Text>
          </Pressable>
        </View>
      ) : null }

      <Pressable
        style={ [ styles.fab, { bottom: Math.max( insets.bottom + 16, 24 ) } ] }
        onPress={ () => router.push( '/search' ) }
        accessibilityLabel="Add Movie"
        accessibilityRole="button"
      >
        <Text style={ styles.fabIcon }>+</Text>
      </Pressable>
    </View>
  );
}

const createStyles = ( colors: ThemeColors ) =>
  StyleSheet.create( {
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    themeToggle: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 16,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    themeToggleText: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '600',
    },
    listContent: {
      padding: 16,
      paddingBottom: 96,
    },
    listEmptyContent: {
      flex: 1,
      justifyContent: 'center',
    },
    cardShell: {
      position: 'relative',
      marginBottom: 12,
      overflow: 'hidden',
      borderRadius: 12,
    },
    deleteAction: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      right: 0,
      width: 110,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      opacity: 0.96,
    },
    deleteActionText: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '700',
      letterSpacing: 0.3,
    },
    cardWrapper: {
      width: '100%',
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    poster: {
      width: 56,
      height: 84,
      borderRadius: 8,
      backgroundColor: colors.border,
    },
    posterPlaceholder: {
      justifyContent: 'center',
      alignItems: 'center',
      padding: 4,
    },
    placeholderText: {
      color: colors.subtext,
      fontSize: 10,
      textAlign: 'center',
    },
    infoContainer: {
      flex: 1,
      marginLeft: 14,
      marginRight: 12,
    },
    title: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 6,
    },
    titleUnwatched: {
      color: colors.text,
    },
    titleWatched: {
      color: colors.subtext,
      textDecorationLine: 'line-through',
    },
    platforms: {
      fontSize: 13,
      color: colors.subtext,
      lineHeight: 18,
    },
    platformsWatched: {
      color: colors.subtext,
      opacity: 0.7,
    },
    noPlatformsText: {
      fontStyle: 'italic',
      color: colors.subtext,
    },
    checkbox: {
      width: 28,
      height: 28,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
    },
    checkboxUnwatched: {
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: 'transparent',
    },
    checkboxWatched: {
      backgroundColor: colors.success,
      borderWidth: 2,
      borderColor: colors.success,
    },
    checkmark: {
      color: '#ffffff',
      fontSize: 15,
      fontWeight: 'bold',
    },
    fab: {
      position: 'absolute',
      right: 20,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.accent,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 5,
      elevation: 6,
    },
    fabIcon: {
      color: '#ffffff',
      fontSize: 32,
      lineHeight: 34,
      fontWeight: '400',
      marginTop: -2,
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
    },
    emptyIcon: {
      fontSize: 56,
      marginBottom: 16,
    },
    emptyTitle: {
      color: colors.text,
      fontSize: 19,
      fontWeight: '600',
      marginBottom: 8,
      textAlign: 'center',
    },
    emptySubtitle: {
      color: colors.subtext,
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
    },
    undoBar: {
      position: 'absolute',
      left: 16,
      right: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 5,
    },
    undoText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '600',
      flex: 1,
      marginRight: 12,
    },
    undoButton: {
      backgroundColor: colors.accent,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
    },
    undoButtonText: {
      color: '#ffffff',
      fontSize: 13,
      fontWeight: '700',
    },
  } );
