import { User } from '../../../models/User'
import { Prediction } from '../../../models/Prediction'
import { Tiebreak } from '../../../models/Tiebreak'

// Admin-only: remove a user along with their predictions and tie-break orders.
// Their session cookie (if any) dies on the next request via requireDbUser.
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const id = getRouterParam(event, 'id') || ''
  if (!/^[0-9a-f]{24}$/i.test(id)) throw createError({ statusCode: 400, statusMessage: 'ID inválido' })

  if (String(admin._id) === id) {
    throw createError({ statusCode: 400, statusMessage: 'No puedes eliminar tu propia cuenta' })
  }

  const user = await User.findById(id)
  if (!user) throw createError({ statusCode: 404, statusMessage: 'Usuario no encontrado' })

  const [preds, ties] = await Promise.all([
    Prediction.deleteMany({ user: user._id }),
    Tiebreak.deleteMany({ user: user._id }),
  ])
  await user.deleteOne()

  return {
    ok: true,
    deleted: {
      username: user.username,
      predictions: preds.deletedCount,
      tiebreaks: ties.deletedCount,
    },
  }
})
