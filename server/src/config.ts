export const config = {
  port: Number(process.env.PORT ?? 3000),
  host: process.env.HOST ?? '0.0.0.0',
  /** Override for local development against a mock TMDB. */
  tmdbBaseUrl: process.env.TMDB_BASE_URL || undefined,
  tmdbApiKey: process.env.TMDB_API_KEY ?? '',
  staticDir: process.env.STATIC_DIR ?? '',
  /** SQLite cache file; empty means memory only. */
  cachePath: process.env.CACHE_PATH ?? '',
  /** Max concurrent in-flight requests to TMDB across all users. */
  tmdbConcurrency: Number(process.env.TMDB_CONCURRENCY ?? 10),
  /** Set when behind a reverse proxy so the real client IP is used for rate limiting. */
  trustProxy: process.env.TRUST_PROXY === 'true',
  /** Requests per minute per IP across the API. */
  rateLimitPerMinute: Number(process.env.RATE_LIMIT_PER_MINUTE ?? 120),
  /** Watchlist uploads per 10 minutes per IP. */
  uploadsPer10Min: Number(process.env.UPLOADS_PER_10_MIN ?? 10),
  /** Watchlist jobs processed at once across all users. */
  maxConcurrentJobs: Number(process.env.MAX_CONCURRENT_JOBS ?? 5),
};
