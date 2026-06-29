export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  modules: ['nuxt-auth-utils', 'nuxt-mongoose'],

  // `uri: ''` intentionally DISABLES nuxt-mongoose's startup auto-connect, so the
  // connection has exactly one owner: ensureMongo() in server/utils/db.ts, awaited
  // by server/middleware/db.ts before every /api/** request. bufferCommands:false
  // makes a too-early query fail loudly instead of buffering for 10s.
  mongoose: {
    uri: '',
    options: {
      bufferCommands: false,
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
      hit: 1, // NUXT_SCORING_HIT — points per correct 1/X/2 pick (group stage)
      koExact: 2, // NUXT_SCORING_KO_EXACT — new bracket: exact knockout scoreline
      koWinner: 1, // NUXT_SCORING_KO_WINNER — new bracket: correct knockout winner only
      // NUXT_SCORING_KO_VOID — comma-separated match codes excluded from scoring
      // entirely (no points, not counted as played), e.g. "R32-03". Lets an
      // organizer neutralise a match nobody could fairly predict. Unset to restore.
      koVoid: '',
    },
    // Session sealing password comes from NUXT_SESSION_PASSWORD (>= 32 chars).
    // Passwords are hashed with scrypt via nuxt-auth-utils (auth.hash.scrypt).
    public: {
      // Feature flag for the scoreline-based knockout bracket built on the ACTUAL
      // qualified teams. OFF (default) = original behavior (old /bracket + /comparar
      // visible, knockout scored from old picks). Set NUXT_PUBLIC_NEW_KO=true to
      // open the new bracket, hide the old pages, and score knockout from scorelines.
      // Flip the env var + restart to enable or fully revert — no data is touched.
      newKo: false,
    },
  },

  // Netlify/Vercel are auto-detected. For a self-hosted Node server (Docker),
  // build with `nuxt build` and run `node .output/server/index.mjs`.
})
