import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Image,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  searchMovies,
  getNowPlaying,
  getProviders,
  getPosterUrl,
  TMDBMovie,
} from '../lib/tmdb';
import { addMovie, hasMovie } from '../lib/db';
import { useTheme, ThemeColors } from '../lib/theme';

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [movies, setMovies] = useState<TMDBMovie[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [savingMovieId, setSavingMovieId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const activeRequestRef = useRef<number>(0);
  const { colors } = useTheme();

  const styles = useMemo(() => createStyles(colors), [colors]);

  const refreshSavedStatus = useCallback((movieList: TMDBMovie[]) => {
    const saved = new Set<number>();
    for (const movie of movieList) {
      if (hasMovie(movie.id)) {
        saved.add(movie.id);
      }
    }
    setSavedIds(saved);
  }, []);

  const fetchMovies = useCallback(
    async (searchQuery: string) => {
      const requestId = ++activeRequestRef.current;
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const trimmed = searchQuery.trim();
        let results: TMDBMovie[] = [];

        if (trimmed.length === 0) {
          results = await getNowPlaying();
        } else {
          results = await searchMovies(trimmed);
        }

        // Only update state if this is still the most recent request
        if (requestId === activeRequestRef.current) {
          setMovies(results);
          refreshSavedStatus(results);
        }
      } catch (err: any) {
        if (requestId === activeRequestRef.current) {
          setMovies([]);
          const message =
            err?.message ||
            'Unable to fetch movies. Please check your network connection and TMDB key.';
          setErrorMessage(message);
        }
      } finally {
        if (requestId === activeRequestRef.current) {
          setIsLoading(false);
        }
      }
    },
    [refreshSavedStatus]
  );

  // 400ms debounce on text input
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchMovies(query);
    }, 400);

    return () => {
      clearTimeout(timer);
    };
  }, [query, fetchMovies]);

  const handleSelectMovie = async (movie: TMDBMovie) => {
    if (savingMovieId !== null) return;

    // If already saved, simply navigate back
    if (hasMovie(movie.id)) {
      router.back();
      return;
    }

    try {
      setSavingMovieId(movie.id);
      Keyboard.dismiss();

      // Fetch watch providers before saving
      const platforms = await getProviders(movie.id);

      addMovie({
        id: movie.id,
        title: movie.title,
        poster_path: movie.poster_path,
        release_date: movie.release_date,
        platforms,
      });

      router.back();
    } catch {
      // In case of error, still save with empty platforms and return
      addMovie({
        id: movie.id,
        title: movie.title,
        poster_path: movie.poster_path,
        release_date: movie.release_date,
        platforms: '',
      });
      router.back();
    } finally {
      setSavingMovieId(null);
    }
  };

  const renderMovieItem = ({ item }: { item: TMDBMovie }) => {
    const isSaved = savedIds.has(item.id) || hasMovie(item.id);
    const isSaving = savingMovieId === item.id;
    const posterUrl = getPosterUrl(item.poster_path);
    const releaseYear =
      item.release_date && item.release_date.length >= 4
        ? item.release_date.slice(0, 4)
        : 'TBA';

    return (
      <Pressable
        style={styles.card}
        onPress={() => handleSelectMovie(item)}
        disabled={isSaving}
      >
        {posterUrl ? (
          <Image source={{ uri: posterUrl }} style={styles.poster} />
        ) : (
          <View style={[styles.poster, styles.posterPlaceholder]}>
            <Text style={styles.placeholderText}>No Poster</Text>
          </View>
        )}

        <View style={styles.infoContainer}>
          <Text style={styles.title} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.year}>{releaseYear}</Text>
        </View>

        <Pressable
          style={[
            styles.addButton,
            isSaved ? styles.addButtonSaved : styles.addButtonActive,
          ]}
          onPress={() => handleSelectMovie(item)}
          disabled={isSaving}
          hitSlop={8}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text
              style={[
                styles.addButtonText,
                isSaved ? styles.addButtonTextSaved : styles.addButtonTextActive,
              ]}
            >
              {isSaved ? 'Added' : 'Add'}
            </Text>
          )}
        </Pressable>
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <View style={styles.searchBarContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search movies..."
          placeholderTextColor={colors.subtext}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {query.length > 0 && (
          <Pressable
            style={styles.clearButton}
            onPress={() => setQuery('')}
            hitSlop={10}
          >
            <Text style={styles.clearButtonText}>✕</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.headerInfo}>
        <Text style={styles.sectionTitle}>
          {query.trim().length === 0 ? 'Now Playing' : 'Search Results'}
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : errorMessage ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Could not load movies</Text>
          <Text style={styles.errorMessage}>{errorMessage}</Text>
          <Pressable
            style={styles.retryButton}
            onPress={() => fetchMovies(query)}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={movies}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderMovieItem}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {query.trim().length === 0
                  ? 'No movies currently playing found.'
                  : `No results found for "${query}".`}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    searchBarContainer: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 8,
      flexDirection: 'row',
      alignItems: 'center',
    },
    searchInput: {
      flex: 1,
      height: 44,
      backgroundColor: colors.card,
      borderRadius: 10,
      paddingHorizontal: 14,
      color: colors.text,
      fontSize: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    clearButton: {
      position: 'absolute',
      right: 26,
      padding: 4,
    },
    clearButtonText: {
      color: colors.subtext,
      fontSize: 14,
      fontWeight: 'bold',
    },
    headerInfo: {
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    sectionTitle: {
      color: colors.subtext,
      fontSize: 13,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    listContent: {
      paddingHorizontal: 16,
      paddingBottom: 24,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    poster: {
      width: 50,
      height: 75,
      borderRadius: 6,
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
      marginRight: 10,
    },
    title: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '600',
      marginBottom: 4,
    },
    year: {
      color: colors.subtext,
      fontSize: 13,
    },
    addButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      minWidth: 72,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addButtonActive: {
      backgroundColor: colors.accent,
    },
    addButtonSaved: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    addButtonText: {
      fontSize: 13,
      fontWeight: '600',
    },
    addButtonTextActive: {
      color: '#ffffff',
    },
    addButtonTextSaved: {
      color: colors.subtext,
    },
    centerContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
    },
    errorIcon: {
      fontSize: 40,
      marginBottom: 12,
    },
    errorTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '600',
      marginBottom: 8,
      textAlign: 'center',
    },
    errorMessage: {
      color: colors.subtext,
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
      marginBottom: 20,
    },
    retryButton: {
      backgroundColor: colors.accent,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 8,
    },
    retryButtonText: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '600',
    },
    emptyContainer: {
      paddingTop: 60,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    emptyText: {
      color: colors.subtext,
      fontSize: 14,
      textAlign: 'center',
    },
  });
