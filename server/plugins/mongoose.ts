import mongoose from 'mongoose'

// Connects the single mongoose instance our models share. nuxt-mongoose also
// auto-connects, but this is the authoritative, observable path: it reads the
// URI from any of the common env vars and LOGS the outcome, so a misconfigured
// deploy shows a clear error instead of silent 10s query-buffering timeouts.
//
// Idempotent: if the connection is already open/opening it no-ops, so there is
// never a duplicate connection.
export default defineNitroPlugin(async () => {
  if (mongoose.connection.readyState !== 0) return // 0 = disconnected

  const cfg = useRuntimeConfig()
  const uri =
    (cfg.mongoose as { uri?: string } | undefined)?.uri ||
    process.env.NUXT_MONGOOSE_URI ||
    process.env.MONGODB_URI ||
    process.env.NUXT_MONGO_URI

  if (!uri) {
    console.error('[mongoose] No MongoDB URI configured — set NUXT_MONGOOSE_URI (or MONGODB_URI).')
    return
  }

  try {
    await mongoose.connect(uri)
    console.log(`[mongoose] connected to ${mongoose.connection.host}/${mongoose.connection.name}`)
  } catch (err) {
    console.error('[mongoose] connection FAILED:', (err as Error).message)
  }
})
