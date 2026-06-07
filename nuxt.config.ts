export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  modules: ['nuxt-auth-utils', 'nuxt-mongoose'],

  // nuxt-mongoose auto-connects on server startup (no manual connect needed).
  // In production the URI comes from NUXT_MONGOOSE_URI at runtime; the fallbacks
  // below only matter for local dev / the build-time default.
  mongoose: {
    uri:
      process.env.NUXT_MONGOOSE_URI ||
      process.env.NUXT_MONGO_URI ||
      process.env.MONGODB_URI ||
      '',
    options: {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 10000,
      maxPoolSize: 5,
      minPoolSize: 0,
      heartbeatFrequencyMS: 10000,
    },
    modelsDir: 'models',
    devtools: false,
  },

  runtimeConfig: {
    scoring: {
      hit: 1, // NUXT_SCORING_HIT — points per correct 1/X/2 pick
    },
    // Session sealing password comes from NUXT_SESSION_PASSWORD (>= 32 chars).
    // Passwords are hashed with scrypt via nuxt-auth-utils (auth.hash.scrypt).
  },

  // Netlify/Vercel are auto-detected. For a self-hosted Node server (Docker),
  // build with `nuxt build` and run `node .output/server/index.mjs`.
})
