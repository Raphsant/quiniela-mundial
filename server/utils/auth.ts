import type { H3Event } from 'h3'
import { User } from '../models/User'

// Resolves the authenticated user from the sealed session and loads the DB record.
export async function requireDbUser(event: H3Event) {
  const { user } = await requireUserSession(event)
  await connectDB()
  const dbUser = await User.findById((user as any).id)
  if (!dbUser) throw createError({ statusCode: 401, statusMessage: 'Unknown user' })
  return dbUser
}

// Admin role is enforced on the server, never trusted from the client.
export async function requireAdmin(event: H3Event) {
  const dbUser = await requireDbUser(event)
  if (!dbUser.isAdmin) throw createError({ statusCode: 403, statusMessage: 'Admin only' })
  return dbUser
}
