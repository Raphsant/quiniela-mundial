import mongoose from 'mongoose'

// Cache the connection across invocations (critical for serverless / hot reload).
const g = globalThis as unknown as { __mongoose?: { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null } }
const cached = g.__mongoose ?? (g.__mongoose = { conn: null, promise: null })

export async function connectDB() {
  if (cached.conn) return cached.conn
  if (!cached.promise) {
    const uri = useRuntimeConfig().mongoUri
    if (!uri) throw createError({ statusCode: 500, statusMessage: 'NUXT_MONGO_URI is not set' })
    cached.promise = mongoose.connect(uri, { bufferCommands: false })
  }
  cached.conn = await cached.promise
  return cached.conn
}
