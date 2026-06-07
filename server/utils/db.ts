import mongoose from 'mongoose'

// Single owner of the MongoDB connection (nuxt-mongoose's auto-connect is off via
// `mongoose.uri: ''`). Cached + idempotent: concurrent requests share one connect
// promise, and once connected this is a no-op. Awaited by server/middleware/db.ts
// before every /api/** handler, so model queries never run unconnected.
let connectionPromise: Promise<typeof mongoose> | null = null

export async function ensureMongo() {
  if (mongoose.connection.readyState === 1) return mongoose // connected
  if (mongoose.connection.readyState === 2 && connectionPromise) return connectionPromise // connecting

  const cfg = useRuntimeConfig()
  const uri =
    (cfg.mongoose as { uri?: string } | undefined)?.uri ||
    process.env.NUXT_MONGOOSE_URI ||
    process.env.MONGODB_URI ||
    process.env.NUXT_MONGO_URI
  if (!uri) {
    throw createError({ statusCode: 500, statusMessage: 'No MongoDB URI set — configure NUXT_MONGOOSE_URI' })
  }

  connectionPromise = mongoose
    .connect(uri, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 10000,
      maxPoolSize: 5,
      minPoolSize: 0,
      heartbeatFrequencyMS: 10000,
    })
    .then((m) => {
      console.log(`[mongoose] connected to ${mongoose.connection.host}/${mongoose.connection.name}`)
      return m
    })
    .catch((err) => {
      connectionPromise = null // allow a retry on the next request
      console.error('[mongoose] connection FAILED:', (err as Error).message)
      throw err
    })

  return connectionPromise
}
