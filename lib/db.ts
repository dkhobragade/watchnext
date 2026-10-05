import * as SQLite from 'expo-sqlite';

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

const db = SQLite.openDatabaseSync('movies.db');

db.execSync(`
  CREATE TABLE IF NOT EXISTS movies (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    poster_path TEXT,
    release_date TEXT,
    platforms TEXT DEFAULT '',
    watched INTEGER DEFAULT 0,
    added_at INTEGER NOT NULL,
    runtime INTEGER,
    genres TEXT
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// Safe migration for existing installs: check columns and add if missing
const tableInfo = db.getAllSync<{ name: string }>('PRAGMA table_info(movies);');
const existingColumns = new Set(tableInfo.map((col) => col.name));

if (!existingColumns.has('runtime')) {
  db.execSync('ALTER TABLE movies ADD COLUMN runtime INTEGER;');
}

if (!existingColumns.has('genres')) {
  db.execSync('ALTER TABLE movies ADD COLUMN genres TEXT;');
}

export function getSetting(key: string, defaultValue: string = ''): string {
  const row = db.getFirstSync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ? LIMIT 1;',
    [key]
  );
  return row?.value ?? defaultValue;
}

export function setSetting(key: string, value: string): void {
  db.runSync(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?);',
    [key, value]
  );
}

export function getMovies(): MovieRecord[] {
  return db.getAllSync<MovieRecord>(
    'SELECT * FROM movies ORDER BY watched ASC, added_at DESC;'
  );
}

export function hasMovie(id: number): boolean {
  const row = db.getFirstSync<{ id: number }>(
    'SELECT id FROM movies WHERE id = ? LIMIT 1;',
    [id]
  );
  return row !== null && row !== undefined;
}

export function addMovie(movie: AddMovieInput): void {
  db.runSync(
    `INSERT OR IGNORE INTO movies (id, title, poster_path, release_date, platforms, watched, added_at, runtime, genres)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?);`,
    [
      movie.id,
      movie.title,
      movie.poster_path ?? null,
      movie.release_date ?? null,
      movie.platforms ?? '',
      Date.now(),
      movie.runtime ?? null,
      movie.genres ?? null,
    ]
  );
}

export function toggleWatched(id: number): void {
  db.runSync(
    'UPDATE movies SET watched = CASE WHEN watched = 1 THEN 0 ELSE 1 END WHERE id = ?;',
    [id]
  );
}

export function updatePlatforms(id: number, platforms: string): void {
  db.runSync(
    'UPDATE movies SET platforms = ? WHERE id = ?;',
    [platforms, id]
  );
}

export function updateMovieDetails(
  id: number,
  runtime: number | null,
  genres: string | null
): void {
  db.runSync(
    'UPDATE movies SET runtime = ?, genres = ? WHERE id = ?;',
    [runtime, genres, id]
  );
}

export function removeMovie(id: number): void {
  db.runSync(
    'DELETE FROM movies WHERE id = ?;',
    [id]
  );
}

export function restoreMovie(movie: MovieRecord): void {
  db.runSync(
    `INSERT OR REPLACE INTO movies (id, title, poster_path, release_date, platforms, watched, added_at, runtime, genres)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      movie.id,
      movie.title,
      movie.poster_path ?? null,
      movie.release_date ?? null,
      movie.platforms ?? '',
      movie.watched,
      movie.added_at,
      movie.runtime ?? null,
      movie.genres ?? null,
    ]
  );
}
