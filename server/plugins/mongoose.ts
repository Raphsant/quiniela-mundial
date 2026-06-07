import mongoose from 'mongoose'

// Guarantees the mongoose instance OUR models use is connected.
//
// nuxt-mongoose already connects on startup, but it force-inlines its runtime,
// so in dev (vite-node) its connection can land on a *second* mongoose copy
// while our models hold the first — queries then buffer and time out. This
// plugin connects the app-context instance (the same one the models import),
// reading the URI that nuxt-mongoose resolved. It's idempotent: if the
// instance is already connecting/connected (the normal production path), it
// no-ops, so there's never a duplicate connection.
export default defineNitroPlugin(async () => {
  if (mongoose.connection.readyState !== 0) return // 0 = disconnected
  const uri = (useRuntimeConfig().mongoose as { uri?: string } | undefined)?.uri
  if (!uri) return
  try {
    await mongoose.connect(uri)
  } catch (err) {
    console.error('[mongoose] connection error:', err)
  }
})
