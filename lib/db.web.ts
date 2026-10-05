export interface MovieRecord {
  id: number;
  title: string;
  poster_path: string | null;
  release_date: string | null;
  platforms: string;
  watched: number; // 0 for unwatched, 1 for watched
  added_at: number; // timestamp
  runtime: number | null;
  genres: string | null;
}

export interface AddMovieInput {
  id: number;
  title: string;
  poster_path: string | null;
  release_date: string | null;
  platforms?: string;
  runtime?: number | null;
  genres?: string | null;
}

const MOVIES_KEY = 'watchnext_movies';
const SETTINGS_KEY = 'watchnext_settings';

function getStorage(): Storage | null {
  if (typeof window === 'undefined' || !('localStorage' in window)) {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readMoviesFromStorage(): MovieRecord[] {
  const storage = getStorage();
  if (!storage) {
    return [];
  }

  try {
    const raw = storage.getItem(MOVIES_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as MovieRecord[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((movie) => movie && typeof movie === 'object');
  } catch {
    return [];
  }
}

function writeMoviesToStorage(movies: MovieRecord[]): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(MOVIES_KEY, JSON.stringify(movies));
  } catch {
    // Fall back to empty data if storage is unavailable or full
  }
}

function readSettingsFromStorage(): Record<string, string> {
  const storage = getStorage();
  if (!storage) {
    return {};
  }

  try {
    const raw = storage.getItem(SETTINGS_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as Record<string, string>;
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }

    return parsed;
  } catch {
    return {};
  }
}

function writeSettingsToStorage(settings: Record<string, string>): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Fall back to empty data if storage is unavailable or full
  }
}

function getNextMovieId(movies: MovieRecord[]): number {
  return movies.reduce((maxId, movie) => Math.max(maxId, Number(movie.id) || 0), 0) + 1;
}

function sortMovies(movies: MovieRecord[]): MovieRecord[] {
  return [...movies].sort((a, b) => {
    if (a.watched !== b.watched) {
      return Number(a.watched) - Number(b.watched);
    }
    return Number(b.added_at) - Number(a.added_at);
  });
}

export function getSetting(key: string, defaultValue: string = ''): string {
  const settings = readSettingsFromStorage();
  return Object.prototype.hasOwnProperty.call(settings, key)
    ? settings[key]
    : defaultValue;
}

export function setSetting(key: string, value: string): void {
  const settings = readSettingsFromStorage();
  settings[key] = value;
  writeSettingsToStorage(settings);
}

export function getMovies(): MovieRecord[] {
  return sortMovies(readMoviesFromStorage());
}

export function hasMovie(id: number): boolean {
  const movies = readMoviesFromStorage();
  return movies.some((movie) => movie.id === id);
}

export function addMovie(movie: AddMovieInput): void {
  const movies = readMoviesFromStorage();

  if (movies.some((existingMovie) => existingMovie.id === movie.id)) {
    return;
  }

  const nextId = Number.isFinite(movie.id) && Number(movie.id) > 0
    ? Number(movie.id)
    : getNextMovieId(movies);

  const nextMovie: MovieRecord = {
    id: nextId,
    title: movie.title,
    poster_path: movie.poster_path ?? null,
    release_date: movie.release_date ?? null,
    platforms: movie.platforms ?? '',
    watched: 0,
    added_at: Date.now(),
    runtime: movie.runtime ?? null,
    genres: movie.genres ?? null,
  };

  const updatedMovies = sortMovies([...movies, nextMovie]);
  writeMoviesToStorage(updatedMovies);
}

export function toggleWatched(id: number): void {
  const movies = readMoviesFromStorage();
  const updatedMovies = movies.map((movie) =>
    movie.id === id
      ? { ...movie, watched: movie.watched === 1 ? 0 : 1 }
      : movie
  );
  writeMoviesToStorage(sortMovies(updatedMovies));
}

export function updatePlatforms(id: number, platforms: string): void {
  const movies = readMoviesFromStorage();
  const updatedMovies = movies.map((movie) =>
    movie.id === id ? { ...movie, platforms } : movie
  );
  writeMoviesToStorage(sortMovies(updatedMovies));
}

export function updateMovieDetails(
  id: number,
  runtime: number | null,
  genres: string | null
): void {
  const movies = readMoviesFromStorage();
  const updatedMovies = movies.map((movie) =>
    movie.id === id ? { ...movie, runtime, genres } : movie
  );
  writeMoviesToStorage(sortMovies(updatedMovies));
}

export function removeMovie(id: number): void {
  const movies = readMoviesFromStorage();
  const updatedMovies = movies.filter((movie) => movie.id !== id);
  writeMoviesToStorage(sortMovies(updatedMovies));
}

export function restoreMovie(movie: MovieRecord): void {
  const movies = readMoviesFromStorage();
  const existingIndex = movies.findIndex((existingMovie) => existingMovie.id === movie.id);

  const updatedMovies = [...movies];

  if (existingIndex >= 0) {
    updatedMovies[existingIndex] = movie;
  } else {
    updatedMovies.push(movie);
  }

  writeMoviesToStorage(sortMovies(updatedMovies));
}
