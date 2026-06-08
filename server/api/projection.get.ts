import { User } from '../models/User'
import { Match } from '../models/Match'
import { Prediction } from '../models/Prediction'
import { Tiebreak } from '../models/Tiebreak'
import { project, type GroupMatch, type Outcome } from '../utils/projection'

// Projects the logged-in user's group-stage picks into a Round-of-32 forecast,
// applying their manual point-tie resolutions.
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const groupMatches = await Match.find({ stage: 'group' }).lean()

  const pickByMatch = new Map<string, Outcome>()
  const tiebreaks: Record<string, string[]> = {}
  if (session?.user) {
    const dbUser = await User.findById((session.user as any).id).lean()
    if (dbUser) {
      const [preds, ties] = await Promise.all([
        Prediction.find({ user: dbUser._id }).lean(),
        Tiebreak.find({ user: dbUser._id }).lean(),
      ])
      for (const p of preds as any[]) if (p.outcome) pickByMatch.set(String(p.match), p.outcome)
      for (const t of ties as any[]) tiebreaks[t.scope] = t.order || []
    }
  }

  const input: GroupMatch[] = groupMatches.map((m: any) => ({
    group: m.group,
    homeTeam: m.homeTeam,
    awayTeam: m.awayTeam,
    pick: pickByMatch.get(String(m._id)) || null,
  }))

  return project(input, tiebreaks)
})
