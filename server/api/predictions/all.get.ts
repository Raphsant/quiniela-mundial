import { User } from '../../models/User'
import { Match } from '../../models/Match'
import { Prediction } from '../../models/Prediction'
import { Tiebreak } from '../../models/Tiebreak'
import { resolveUserBracket, realAdvanceSide } from '../../utils/bracket'
import { outcome, type Outcome } from '../../utils/scoring'

// Player-facing: everyone's predictions, for the group stage and per-user brackets.
// Anti-copy: other players' picks are only revealed once the tournament locks
// (the first kickoff). Before that you only ever see your own.
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) return { loggedIn: false }
  const me = await User.findById((session.user as any).id).lean()
  if (!me) return { loggedIn: false }

  const [users, matches, preds, ties] = await Promise.all([
    User.find().lean(),
    Match.find().sort({ kickoffAt: 1 }).lean(),
    Prediction.find().lean(),
    Tiebreak.find().lean(),
  ])

  const groupMatches = matches.filter((m: any) => m.stage === 'group')
  const koMatches = matches.filter((m: any) => m.stage !== 'group')

  const firstKickoff = matches.length
    ? Math.min(...matches.map((m: any) => new Date(m.kickoffAt).getTime()))
    : Infinity
  const locked = Date.now() >= firstKickoff
  const reveal = locked // once locked, picks can no longer change → safe to show all

  const visibleUsers = reveal ? users : users.filter((u: any) => String(u._id) === String(me._id))
  const visibleIds = new Set(visibleUsers.map((u: any) => String(u._id)))

  // Index each visible user's picks + tie-breaks.
  const codeById = new Map(koMatches.map((m: any) => [String(m._id), m.code]))
  const groupPickByUser = new Map<string, Map<string, Outcome>>()
  const koPickByUser = new Map<string, Map<string, Outcome>>()
  const tiesByUser = new Map<string, Record<string, string[]>>()
  for (const p of preds as any[]) {
    const uid = String(p.user)
    if (!visibleIds.has(uid) || !p.outcome) continue
    const code = codeById.get(String(p.match))
    if (code) {
      if (!koPickByUser.has(uid)) koPickByUser.set(uid, new Map())
      koPickByUser.get(uid)!.set(code, p.outcome)
    } else {
      if (!groupPickByUser.has(uid)) groupPickByUser.set(uid, new Map())
      groupPickByUser.get(uid)!.set(String(p.match), p.outcome)
    }
  }
  for (const t of ties as any[]) {
    const uid = String(t.user)
    if (!visibleIds.has(uid)) continue
    if (!tiesByUser.has(uid)) tiesByUser.set(uid, {})
    tiesByUser.get(uid)![t.scope] = t.order || []
  }

  // Real results → the pick that scores a point on each finished match.
  // Group: exact 1/X/2 outcome. Knockout: the side that advanced (penalties via advancer).
  const winningPick = new Map<string, Outcome>()
  for (const m of matches as any[]) {
    if (m.status !== 'finished' || m.homeGoals == null || m.awayGoals == null) continue
    if (m.stage === 'group') winningPick.set(String(m._id), outcome(m.homeGoals, m.awayGoals))
    else {
      const side = realAdvanceSide(m)
      if (side) winningPick.set(String(m._id), side)
    }
  }
  const koResult: Record<string, Outcome | null> = {}
  for (const m of koMatches as any[]) koResult[m.code] = (winningPick.get(String(m._id)) as Outcome) ?? null

  // Group stage, already chronological (matches sorted by kickoff).
  const group = groupMatches.map((m: any) => {
    const id = String(m._id)
    const picks: Record<string, Outcome> = {}
    for (const uid of visibleIds) {
      const o = groupPickByUser.get(uid)?.get(id)
      if (o) picks[uid] = o
    }
    return {
      _id: id,
      code: m.code,
      group: m.group,
      kickoffAt: m.kickoffAt,
      venue: m.venue || null,
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
      homeGoals: m.homeGoals,
      awayGoals: m.awayGoals,
      status: m.status,
      result: winningPick.get(id) ?? null, // 'H' | 'D' | 'A' | null
      picks,
    }
  })

  // Each visible user's resolved bracket (their group picks build it).
  const brackets: Record<string, any> = {}
  for (const u of visibleUsers as any[]) {
    const uid = String(u._id)
    const ub = resolveUserBracket({
      groupMatches,
      koMatches,
      groupPickByMatch: groupPickByUser.get(uid) || new Map(),
      koPickByCode: koPickByUser.get(uid) || new Map(),
      tiebreaks: tiesByUser.get(uid) || {},
    })
    brackets[uid] = {
      canResolve: ub.canResolve,
      champion: ub.champion,
      predictedCount: ub.proj.predictedCount,
      totalGames: ub.proj.totalGames,
      matches: ub.resolved.map((r) => ({
        code: r.match.code,
        stage: r.match.stage,
        kickoffAt: r.match.kickoffAt,
        venue: r.match.venue || null,
        home: r.home, // { team, label }
        away: r.away,
        pick: koPickByUser.get(uid)?.get(r.match.code) || null,
        winner: r.winner,
      })),
    }
  }

  return {
    loggedIn: true,
    locked,
    reveal,
    me: { id: String(me._id), name: me.displayName || me.username },
    players: visibleUsers
      .map((u: any) => ({ id: String(u._id), name: u.displayName || u.username, isAdmin: !!u.isAdmin }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    koResult,
    group,
    brackets,
  }
})
