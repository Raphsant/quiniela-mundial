import { z } from 'zod'
import { Match } from '../../../models/Match'

const schema = z.object({
  homeGoals: z.number().int().min(0).max(99),
  awayGoals: z.number().int().min(0).max(99),
  // Knockout matches that end level: which side advanced (penalties).
  advancer: z.enum(['H', 'A']).nullable().optional(),
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')
  const body = await readValidatedBody(event, schema.parse)

  const match = await Match.findById(id)
  if (!match) throw createError({ statusCode: 404, statusMessage: 'Match not found' })

  // `advancer` only means something for a LEVEL knockout score; anything else
  // stores null so a later score edit can't leave a stale winner behind.
  const advancer =
    match.stage !== 'group' && body.homeGoals === body.awayGoals ? body.advancer ?? null : null

  match.set({ homeGoals: body.homeGoals, awayGoals: body.awayGoals, status: 'finished', advancer })
  await match.save()

  return {
    _id: String(match._id),
    homeGoals: match.homeGoals,
    awayGoals: match.awayGoals,
    advancer: match.advancer,
    status: match.status,
  }
})
