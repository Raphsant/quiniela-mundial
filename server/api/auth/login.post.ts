import { z } from 'zod'
import { User } from '../../models/User'

const schema = z.object({
  username: z.string().min(1).max(50),
  password: z.string().min(1).max(200),
})

export default defineEventHandler(async (event) => {
  const { username, password } = await readValidatedBody(event, schema.parse)

  const dbUser = await User.findOne({ username: username.trim().toLowerCase() })

  // verifyPassword (nuxt-auth-utils) uses scrypt; the lookup + verify are both
  // required so a missing user and a wrong password are indistinguishable.
  if (!dbUser || !(await verifyPassword(dbUser.passwordHash, password))) {
    throw createError({ statusCode: 401, statusMessage: 'Usuario o contraseña incorrectos' })
  }

  await setUserSession(event, {
    user: {
      id: String(dbUser._id),
      username: dbUser.username,
      displayName: dbUser.displayName || dbUser.username,
      isAdmin: dbUser.isAdmin,
    },
    loggedInAt: new Date().toISOString(),
  })

  return { ok: true }
})
