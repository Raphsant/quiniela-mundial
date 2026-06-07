export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  modules: ['nuxt-auth-utils'],

  runtimeConfig: {
    mongoUri: '', // NUXT_MONGO_URI
    scoring: {
      hit: 1, // NUXT_SCORING_HIT — points per correct 1/X/2 pick
    },
    // Session sealing password comes from NUXT_SESSION_PASSWORD (>= 32 chars).
    // Passwords are hashed with scrypt via nuxt-auth-utils (auth.hash.scrypt).
  }, mongoose: {
    uri: '',
        options: {
        bufferCommands: false,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 10000,
            maxPoolSize: 5,
            minPoolSize: 0,
            heartbeatFrequencyMS: 10000,
    },
    modelsDir: "models",
        devtools: true,
},

  // Netlify/Vercel are auto-detected. For a self-hosted Node server (Docker),
  // build with `nuxt build` and run `node .output/server/index.mjs`.
})
