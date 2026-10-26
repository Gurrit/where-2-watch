export const config = {
  port: Number(process.env.PORT ?? 3000),
  host: process.env.HOST ?? '0.0.0.0',
  tmdbApiKey: process.env.TMDB_API_KEY ?? '',
  staticDir: process.env.STATIC_DIR ?? '',
};
