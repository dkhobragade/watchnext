const REGION = 'IN';

export const TMDB_POSTER_BASE_URL = 'https://image.tmdb.org/t/p/w342';

export interface TMDBMovie {
  id: number;
  title: string;
  poster_path: string | null;
  release_date: string | null;
  overview?: string;
  vote_average?: number;
}

interface WatchProvider {
  provider_id: number;
  provider_name: string;
  logo_path?: string;
}

interface WatchProvidersByRegion {
  flatrate?: WatchProvider[];
  rent?: WatchProvider[];
  buy?: WatchProvider[];
}

interface WatchProvidersResponse {
  id: number;
  results: Record<string, WatchProvidersByRegion>;
}

export function getPosterUrl(posterPath: string | null | undefined): string | null {
  if (!posterPath) return null;
  return `${TMDB_POSTER_BASE_URL}${posterPath}`;
}

async function tmdbFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const apiKey = process.env.EXPO_PUBLIC_TMDB_KEY?.trim();
  if (!apiKey) {
    throw new Error('TMDB API key is missing. Please set EXPO_PUBLIC_TMDB_KEY in your .env file.');
  }

  const queryParams = new URLSearchParams(params);
  const isBearer = apiKey.length > 50 || apiKey.startsWith('ey');

  if (!isBearer) {
    queryParams.set('api_key', apiKey);
  }

  const queryString = queryParams.toString();
  const url = `https://api.themoviedb.org/3${endpoint}${queryString ? `?${queryString}` : ''}`;

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (isBearer) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Invalid TMDB API key. Please check your EXPO_PUBLIC_TMDB_KEY in .env.');
    }
    throw new Error(`TMDB API request failed (${response.status})`);
  }

  return response.json() as Promise<T>;
}

export async function searchMovies(query: string): Promise<TMDBMovie[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const data = await tmdbFetch<{ results: TMDBMovie[] }>('/search/movie', {
    query: trimmed,
    include_adult: 'false',
    region: REGION,
  });

  return data.results ?? [];
}

export async function getNowPlaying(): Promise<TMDBMovie[]> {
  const data = await tmdbFetch<{ results: TMDBMovie[] }>('/movie/now_playing', {
    region: REGION,
  });

  return data.results ?? [];
}

export async function getUpcoming(): Promise<TMDBMovie[]> {
  const data = await tmdbFetch<{ results: TMDBMovie[] }>('/movie/upcoming', {
    region: REGION,
  });

  return data.results ?? [];
}

export async function getProviders(movieId: number): Promise<string> {
  try {
    const data = await tmdbFetch<WatchProvidersResponse>(`/movie/${movieId}/watch/providers`);
    const inRegion = data?.results?.[REGION];
    if (!inRegion) {
      return '';
    }

    let selectedProviders: WatchProvider[] = [];
    if (Array.isArray(inRegion.flatrate) && inRegion.flatrate.length > 0) {
      selectedProviders = inRegion.flatrate;
    } else if (Array.isArray(inRegion.rent) && inRegion.rent.length > 0) {
      selectedProviders = inRegion.rent;
    } else if (Array.isArray(inRegion.buy) && inRegion.buy.length > 0) {
      selectedProviders = inRegion.buy;
    }

    const uniqueNames = Array.from(
      new Set(
        selectedProviders
          .map((provider) => provider.provider_name?.trim())
          .filter((name): name is string => Boolean(name))
      )
    );

    return uniqueNames.join(', ');
  } catch {
    return '';
  }
}
