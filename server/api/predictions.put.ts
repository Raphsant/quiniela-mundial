import { z } from 'zod'
import { Match } from '../models/Match'
import { Prediction } from '../models/Prediction'

const schema = z.object({
  matchId: z.string().length(24),
  outcome: z.enum(['H', 'D', 'A']),
})

export default defineEventHandler(async (event) => {
  const dbUser = await requireDbUser(event)
  const body = await readValidatedBody(event, schema.parse)

  await connectDB()
  const match = await Match.findById(body.matchId)
  if (!match) throw createError({ statusCode: 404, statusMessage: 'Match not found' })

  // Single global lock: once the FIRST match of the tournament kicks off, all
  // predictions close. Until then every prediction can still be edited.
  const first = await Match.findOne().sort({ kickoffAt: 1 }).select('kickoffAt').lean()
  if (first && Date.now() >= new Date((first as any).kickoffAt).getTime()) {
    throw createError({ statusCode: 403, statusMessage: 'Las predicciones están cerradas: el torneo ya comenzó' })
  }

  // Knockout ties must resolve to a side — no draws allowed there.
  if (body.outcome === 'D' && match.stage !== 'group') {
    throw createError({ statusCode: 400, statusMessage: 'En eliminatorias debes elegir un ganador' })
  }

  const pred = await Prediction.findOneAndUpdate(
    { user: dbUser._id, match: match._id },
    { outcome: body.outcome },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )

  return { matchId: String(match._id), outcome: pred.outcome }
})
