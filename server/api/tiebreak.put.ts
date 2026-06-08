import { z } from 'zod'
import { Match } from '../models/Match'
import { Tiebreak } from '../models/Tiebreak'

const schema = z.object({
  scope: z.string().regex(/^([A-L]|THIRDS)$/), // group letter or the thirds cutoff
  order: z.array(z.string().min(1).max(60)).min(2).max(12), // tied teams, best → worst
})

export default defineEventHandler(async (event) => {
  const dbUser = await requireDbUser(event)
  const body = await readValidatedBody(event, schema.parse)

  // Same global lock as predictions: nothing changes once the tournament starts.
  const first = await Match.findOne().sort({ kickoffAt: 1 }).select('kickoffAt').lean()
  if (first && Date.now() >= new Date((first as any).kickoffAt).getTime()) {
    throw createError({ statusCode: 403, statusMessage: 'El torneo ya comenzó: los desempates están cerrados' })
  }

  await Tiebreak.findOneAndUpdate(
    { user: dbUser._id, scope: body.scope },
    { order: body.order },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )
  return { ok: true, scope: body.scope, order: body.order }
})
