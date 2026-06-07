import { User } from '../../models/User'
import { Match } from '../../models/Match'
import { Prediction } from '../../models/Prediction'

export default defineEventHandler(async (event) => {
  const matches = await Match.find().sort({ kickoffAt: 1 }).lean()

  // Attach this user's predictions if logged in.
  const session = await getUserSession(event)
  const predByMatch = new Map<string, { outcome: string }>()
  if (session?.user) {
    const dbUser = await User.findById((session.user as any).id).lean()
    if (dbUser) {
      const preds = await Prediction.find({ user: dbUser._id }).lean()
      for (const p of preds) predByMatch.set(String(p.match), { outcome: (p as any).outcome })
    }
  }

  const now = Date.now()
  // Single global deadline: predictions stay editable until the FIRST match of the
  // tournament kicks off. Once that instant passes, every prediction locks.
  const firstKickoff = matches.length
    ? Math.min(...matches.map((m: any) => new Date(m.kickoffAt).getTime()))
    : Infinity
  const tournamentStarted = now >= firstKickoff

  return matches.map((m: any) => ({
    _id: String(m._id),
    code: m.code,
    stage: m.stage,
    group: m.group,
    homeTeam: m.homeTeam,
    awayTeam: m.awayTeam,
    kickoffAt: m.kickoffAt,
    venue: m.venue || null,
    homeGoals: m.homeGoals,
    awayGoals: m.awayGoals,
    status: m.status,
    locked: tournamentStarted,
    prediction: predByMatch.get(String(m._id)) || null,
  }))
})
