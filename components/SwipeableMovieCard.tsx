import React, { useRef, useCallback } from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import ReanimatedSwipeable, {
  SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, {
  SharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { MovieRecord } from '../lib/db';
import { getPosterUrl } from '../lib/tmdb';
import { ThemeColors } from '../lib/theme';

const ACTION_WIDTH = 80;

interface Props {
  movie: MovieRecord;
  colors: ThemeColors;
  onToggleWatched: (id: number) => void;
  onRemove: (movie: MovieRecord) => void;
  onOpen: (id: number) => void; // notify parent so it can close other cards
  openId: number | null;        // id of the currently open card (from parent)
}

function RightAction({
  progress,
  drag,
  onPress,
}: {
  progress: SharedValue<number>;
  drag: SharedValue<number>;
  onPress: () => void;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    // progress goes 0→1 as the card opens to ACTION_WIDTH
    const scale = interpolate(
      progress.value,
      [0, 1],
      [0.7, 1],
      Extrapolation.CLAMP
    );
    const opacity = interpolate(
      progress.value,
      [0, 0.5, 1],
      [0, 0.7, 1],
      Extrapolation.CLAMP
    );
    return { transform: [{ scale }], opacity };
  });

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Remove movie"
      style={styles.actionOuter}
    >
      <Animated.View style={[styles.actionInner, animatedStyle]}>
        <Text style={styles.trashIcon}>🗑️</Text>
        <Text style={styles.removeLabel}>Remove</Text>
      </Animated.View>
    </Pressable>
  );
}

export default function SwipeableMovieCard({
  movie,
  colors,
  onToggleWatched,
  onRemove,
  onOpen,
  openId,
}: Props) {
  const swipeableRef = useRef<SwipeableMethods>(null);
  const isWatched = movie.watched === 1;
  const posterUrl = getPosterUrl(movie.poster_path);
  const platformDisplay =
    movie.platforms && movie.platforms.trim().length > 0
      ? movie.platforms
      : 'Not on streaming yet';

  // If another card was opened, close this one
  const prevOpenId = useRef<number | null>(null);
  if (openId !== movie.id && prevOpenId.current === movie.id) {
    swipeableRef.current?.close();
  }
  prevOpenId.current = openId;

  const handleSwipeOpen = useCallback(() => {
    onOpen(movie.id);
  }, [movie.id, onOpen]);

  const renderRightActions = useCallback(
    (
      progress: SharedValue<number>,
      drag: SharedValue<number>,
      methods: SwipeableMethods
    ) => (
      <RightAction
        progress={progress}
        drag={drag}
        onPress={() => {
          methods.close();
          onRemove(movie);
        }}
      />
    ),
    [movie, onRemove]
  );

  const cardStyle = [
    styles.card,
    { backgroundColor: colors.card, borderColor: colors.border },
  ];

  return (
    <View style={styles.shell}>
      <ReanimatedSwipeable
        ref={swipeableRef}
        renderRightActions={renderRightActions}
        rightThreshold={ACTION_WIDTH * 0.4} // ~40% of card to auto-delete
        overshootRight={false}
        friction={2}
        onSwipeableOpen={handleSwipeOpen}
        containerStyle={styles.swipeContainer}
      >
        <Pressable
          style={cardStyle}
          onLongPress={() => onRemove(movie)}
          delayLongPress={600}
          // long-press as the only secondary deletion path (no Alert, kept minimal)
        >
          {posterUrl ? (
            <Image source={{ uri: posterUrl }} style={styles.poster} />
          ) : (
            <View
              style={[
                styles.poster,
                styles.posterPlaceholder,
                { backgroundColor: colors.border },
              ]}
            >
              <Text style={[styles.placeholderText, { color: colors.subtext }]}>
                No Poster
              </Text>
            </View>
          )}

          <View style={styles.infoContainer}>
            <Text
              style={[
                styles.title,
                isWatched
                  ? { color: colors.subtext, textDecorationLine: 'line-through' }
                  : { color: colors.text },
              ]}
              numberOfLines={2}
            >
              {movie.title}
            </Text>
            <Text
              style={[
                styles.platforms,
                { color: colors.subtext },
                !movie.platforms && styles.noPlatformsText,
                isWatched && { opacity: 0.7 },
              ]}
              numberOfLines={2}
            >
              {platformDisplay}
            </Text>
          </View>

          <Pressable
            style={[
              styles.checkbox,
              isWatched
                ? { backgroundColor: colors.success, borderColor: colors.success }
                : { borderColor: colors.border },
            ]}
            onPress={() => onToggleWatched(movie.id)}
            hitSlop={12}
          >
            {isWatched ? (
              <Text style={styles.checkmark}>✓</Text>
            ) : null}
          </Pressable>
        </Pressable>
      </ReanimatedSwipeable>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    marginBottom: 12,
  },
  swipeContainer: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  actionOuter: {
    width: ACTION_WIDTH,
    backgroundColor: '#c0010f', // slightly darker red, same in both themes
    justifyContent: 'center',
    alignItems: 'center',
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  actionInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  trashIcon: {
    fontSize: 22,
  },
  removeLabel: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  poster: {
    width: 56,
    height: 84,
    borderRadius: 8,
  },
  posterPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  placeholderText: {
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
  platforms: {
    fontSize: 13,
    lineHeight: 18,
  },
  noPlatformsText: {
    fontStyle: 'italic',
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
