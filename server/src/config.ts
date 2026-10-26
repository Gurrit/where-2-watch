export const config = {
  port: Number(process.env.PORT ?? 3000),
  host: process.env.HOST ?? '0.0.0.0',
  tmdbApiKey: process.env.TMDB_API_KEY ?? '',
  staticDir: process.env.STATIC_DIR ?? '',
  /** SQLite cache file; empty means memory only. */
  cachePath: process.env.CACHE_PATH ?? '',
  /** Max concurrent in-flight requests to TMDB across all users. */
  tmdbConcurrency: Number(process.env.TMDB_CONCURRENCY ?? 10),
};
