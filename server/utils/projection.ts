// Pure group-stage projection: given a user's 1/X/2 picks, simulate every group
// table and work out who reaches the Round of 32 under the 2026 format
// (12 groups of 4 → top 2 of each group + the 8 best third-placed teams = 32).
//
// No scorelines exist, so the real tie-break (goal difference) is impossible.
// Therefore: teams level on POINTS are NOT auto-ordered — the user must resolve
// each such tie by hand (passed in via `tiebreaks`). Unresolved ties are
// reported in `pendingTies`, and block the bracket until settled.

export type Outcome = 'H' | 'D' | 'A'

export interface GroupMatch {
  group: string
  homeTeam: string
  awayTeam: string
  pick: Outcome | null
}

export interface TeamRow {
  name: string
  group: string
  played: number
  w: number
  d: number
  l: number
  pts: number
  rank: number
  advances: boolean
  isThird: boolean
  tied: boolean // shares points with another team
}

export interface ThirdRow {
  name: string
  group: string
  pts: number
  qualifies: boolean
  tied: boolean
}

export interface PendingTie {
  scope: string // group letter, or 'THIRDS'
  kind: 'group' | 'thirds'
  pts: number
  teams: { name: string; group: string; pts: number }[]
}

export interface Projection {
  groups: { group: string; complete: boolean; pendingTie: boolean; teams: TeamRow[] }[]
  thirds: ThirdRow[]
  thirdsPendingTie: boolean
  advancing: { name: string; group: string; via: 'top2' | 'third' }[]
  pendingTies: PendingTie[]
  tiesResolved: boolean
  predictedCount: number
  totalGames: number
  complete: boolean
}

interface Acc {
  name: string
  group: string
  played: number
  w: number
  d: number
  l: number
  pts: number
}

// Order index within a user-provided tie-break list (unlisted teams sort last).
function orderIndex(order: string[], name: string) {
  const i = order.indexOf(name)
  return i === -1 ? Number.MAX_SAFE_INTEGER : i
}

export function project(matches: GroupMatch[], tiebreaks: Record<string, string[]> = {}): Projection {
  const groupNames = [...new Set(matches.map((m) => m.group))].sort()
  const predictedCount = matches.filter((m) => m.pick).length
  const pendingTies: PendingTie[] = []

  const groups = groupNames.map((g) => {
    const gMatches = matches.filter((m) => m.group === g)
    const acc = new Map<string, Acc>()
    const team = (n: string) => {
      if (!acc.has(n)) acc.set(n, { name: n, group: g, played: 0, w: 0, d: 0, l: 0, pts: 0 })
      return acc.get(n)!
    }
    for (const m of gMatches) {
      team(m.homeTeam)
      team(m.awayTeam)
    }
    for (const m of gMatches) {
      if (!m.pick) continue
      const h = team(m.homeTeam)
      const a = team(m.awayTeam)
      h.played++
      a.played++
      if (m.pick === 'H') { h.w++; h.pts += 3; a.l++ }
      else if (m.pick === 'A') { a.w++; a.pts += 3; h.l++ }
      else { h.d++; a.d++; h.pts++; a.pts++ }
    }

    const tb = tiebreaks[g] || []
    // Sort: points desc → user's manual order → name (provisional fallback).
    const rows = [...acc.values()].sort(
      (x, y) => y.pts - x.pts || orderIndex(tb, x.name) - orderIndex(tb, y.name) || x.name.localeCompare(y.name),
    )

    // Points clusters of size ≥2 are ties.
    const sizeByPts = new Map<number, number>()
    for (const r of rows) sizeByPts.set(r.pts, (sizeByPts.get(r.pts) || 0) + 1)
    const complete = gMatches.length > 0 && gMatches.every((m) => m.pick)

    // A cluster is resolved once every team in it appears in the user's order.
    const clusters = [...sizeByPts.entries()].filter(([, n]) => n >= 2)
    const unresolved = clusters.filter(([pts]) =>
      !rows.filter((r) => r.pts === pts).every((r) => tb.includes(r.name)),
    )
    const pendingTie = complete && unresolved.length > 0
    if (pendingTie) {
      // Report each unresolved cluster (in current provisional order) for the UI.
      for (const [pts] of unresolved) {
        pendingTies.push({
          scope: g,
          kind: 'group',
          pts,
          teams: rows.filter((r) => r.pts === pts).map((r) => ({ name: r.name, group: g, pts: r.pts })),
        })
      }
    }

    const teams: TeamRow[] = rows.map((r, i) => ({
      name: r.name,
      group: g,
      played: r.played,
      w: r.w,
      d: r.d,
      l: r.l,
      pts: r.pts,
      rank: i + 1,
      advances: i < 2,
      isThird: i === 2,
      tied: (sizeByPts.get(r.pts) || 0) >= 2,
    }))
    return { group: g, complete, pendingTie, teams }
  })

  // Best thirds — only meaningful once every group is settled (complete + no tie),
  // because each group's 3rd place depends on its resolved order.
  const groupsSettled = groups.every((g) => g.complete && !g.pendingTie)
  const tbT = tiebreaks['THIRDS'] || []
  const thirdsRaw = groups.map((g) => g.teams[2]).filter(Boolean).map((t) => ({ name: t!.name, group: t!.group, pts: t!.pts }))
  const thirdsSorted = [...thirdsRaw].sort(
    (a, b) => b.pts - a.pts || orderIndex(tbT, a.name) - orderIndex(tbT, b.name) || a.name.localeCompare(b.name),
  )

  // Does the 8-team cutoff fall inside a points cluster? If so it needs resolving.
  let thirdsPendingTie = false
  if (groupsSettled && thirdsSorted.length > 8) {
    const cutoffPts = thirdsSorted[7].pts
    const above = thirdsSorted.filter((t) => t.pts > cutoffPts).length
    const atCluster = thirdsSorted.filter((t) => t.pts === cutoffPts)
    const splitsCutoff = above < 8 && above + atCluster.length > 8
    if (splitsCutoff && !atCluster.every((t) => tbT.includes(t.name))) {
      thirdsPendingTie = true
      pendingTies.push({ scope: 'THIRDS', kind: 'thirds', pts: cutoffPts, teams: atCluster })
    }
  }

  const thirdsPtsCount = new Map<number, number>()
  for (const t of thirdsSorted) thirdsPtsCount.set(t.pts, (thirdsPtsCount.get(t.pts) || 0) + 1)
  const thirds: ThirdRow[] = thirdsSorted.map((t, i) => ({
    name: t.name,
    group: t.group,
    pts: t.pts,
    qualifies: i < 8,
    tied: (thirdsPtsCount.get(t.pts) || 0) >= 2,
  }))

  const advancing: Projection['advancing'] = []
  for (const g of groups) for (const t of g.teams) if (t.advances) advancing.push({ name: t.name, group: g.group, via: 'top2' })
  for (const t of thirds) if (t.qualifies) advancing.push({ name: t.name, group: t.group, via: 'third' })

  return {
    groups,
    thirds,
    thirdsPendingTie,
    advancing,
    pendingTies,
    tiesResolved: pendingTies.length === 0,
    predictedCount,
    totalGames: matches.length,
    complete: predictedCount === matches.length && matches.length > 0,
  }
}
