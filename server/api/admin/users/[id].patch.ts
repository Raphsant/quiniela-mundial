import { z } from 'zod'
import { User } from '../../../models/User'

// Admin-only: edit a user's display name (the name shown everywhere in the UI).
const schema = z.object({
  displayName: z.string().max(80), // empty clears it → username is shown instead
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id') || ''
  if (!/^[0-9a-f]{24}$/i.test(id)) throw createError({ statusCode: 400, statusMessage: 'ID inválido' })
  const body = await readValidatedBody(event, schema.parse)

  const user = await User.findById(id)
  if (!user) throw createError({ statusCode: 404, statusMessage: 'Usuario no encontrado' })

  user.displayName = body.displayName.trim()
  await user.save()

  return {
    ok: true,
    user: {
      id: String(user._id),
      username: user.username,
      displayName: user.displayName || user.username,
      isAdmin: !!user.isAdmin,
    },
  }
})
