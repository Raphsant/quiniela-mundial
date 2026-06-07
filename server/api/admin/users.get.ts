import { User } from '../../models/User'
import { Match } from '../../models/Match'
import { Prediction } from '../../models/Prediction'

// Admin-only, READ-ONLY: every registered user with the predictions they've made.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const [users, matches, preds] = await Promise.all([
    User.find().lean(),
    Match.find().select('code stage homeTeam awayTeam kickoffAt').lean(),
    Prediction.find().lean(),
  ])

  const matchById = new Map(matches.map((m: any) => [String(m._id), m]))
  const byUser = new Map<string, any[]>()
  for (const p of preds as any[]) {
    const arr = byUser.get(String(p.user)) || []
    arr.push(p)
    byUser.set(String(p.user), arr)
  }

  const rows = users
    .map((u: any) => {
      const predictions = (byUser.get(String(u._id)) || [])
        .map((p: any) => {
          const m = matchById.get(String(p.match))
          if (!m) return null
          return {
            code: m.code,
            stage: m.stage,
            home: m.homeTeam, // null for knockout matches (resolved per-user)
            away: m.awayTeam,
            outcome: p.outcome, // 'H' | 'D' | 'A'
          }
        })
        .filter(Boolean)
        .sort((a: any, b: any) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true }))

      return {
        id: String(u._id),
        username: u.username,
        displayName: u.displayName || u.username,
        isAdmin: !!u.isAdmin,
        count: predictions.length,
        predictions,
      }
    })
    .sort((a, b) => b.count - a.count || a.username.localeCompare(b.username))

  return { totalMatches: matches.length, users: rows }
})
