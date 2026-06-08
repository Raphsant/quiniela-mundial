import { z } from 'zod'
import { User } from '../../models/User'

// Admin-only: create a new login user from the admin panel (phone-friendly
// equivalent of `npm run create-user`). hashPassword (nuxt-auth-utils) uses the
// same scrypt driver verifyPassword expects, so the hash is login-compatible.
const schema = z.object({
  username: z.string().min(1).max(50),
  password: z.string().min(6).max(200),
  displayName: z.string().max(80).optional(),
  isAdmin: z.boolean().optional(),
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const body = await readValidatedBody(event, schema.parse)
  const username = body.username.trim().toLowerCase()
  const displayName = (body.displayName?.trim() || body.username.trim())

  // Create-only: don't silently overwrite an existing user's password.
  const existing = await User.findOne({ username })
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'Ese usuario ya existe' })
  }

  const passwordHash = await hashPassword(body.password)
  const created = await User.create({
    username,
    passwordHash,
    displayName,
    isAdmin: !!body.isAdmin,
  })

  return {
    ok: true,
    user: {
      id: String(created._id),
      username: created.username,
      displayName: created.displayName || created.username,
      isAdmin: !!created.isAdmin,
    },
  }
})
