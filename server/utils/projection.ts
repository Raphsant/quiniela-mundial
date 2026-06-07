// Pure group-stage projection: given a user's 1/X/2 picks, simulate every group
// table and work out who reaches the Round of 32 under the 2026 format
// (12 groups of 4 → top 2 of each group + the 8 best third-placed teams = 32).
//
// No scorelines exist, so classic goal-difference tie-breaks are impossible.
// We break ties transparently: points → wins → head-to-head points among the
// tied teams → team name (alphabetical, flagged as provisional).

export type Outcome = 'H' | 'D' | 'A'

export interface GroupMatch {
  group: string
  homeTeam: string
  awayTeam: string
  pick: Outcome | null // the user's prediction for this match (null if unpicked)
}

export interface TeamRow {
  name: string
  group: string
  played: number
  w: number
  d: number
  l: number
  pts: number
  rank: number // 1-4 within the group
  advances: boolean // top-2 (guaranteed) — third-placed handled separately
  isThird: boolean
  tied: boolean // shares pts+wins with a neighbour → order is provisional
}

export interface ThirdRow {
  name: string
  group: string
  pts: number
  w: number
  played: number
  qualifies: boolean
  tied: boolean
}

export interface Projection {
  groups: { group: string; complete: boolean; teams: TeamRow[] }[]
  thirds: ThirdRow[]
  advancing: { name: string; group: string; via: 'top2' | 'third' }[]
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

function blank(name: string, group: string): Acc {
  return { name, group, played: 0, w: 0, d: 0, l: 0, pts: 0 }
}

// Head-to-head points among a specific set of teams, from the picked results.
function h2hPoints(teams: string[], matches: GroupMatch[]): Map<string, number> {
  const set = new Set(teams)
  const pts = new Map<string, number>(teams.map((t) => [t, 0]))
  for (const m of matches) {
    if (!m.pick || !set.has(m.homeTeam) || !set.has(m.awayTeam)) continue
    if (m.pick === 'H') pts.set(m.homeTeam, (pts.get(m.homeTeam) || 0) + 3)
    else if (m.pick === 'A') pts.set(m.awayTeam, (pts.get(m.awayTeam) || 0) + 3)
    else {
      pts.set(m.homeTeam, (pts.get(m.homeTeam) || 0) + 1)
      pts.set(m.awayTeam, (pts.get(m.awayTeam) || 0) + 1)
    }
  }
  return pts
}

export function project(matches: GroupMatch[]): Projection {
  const groupNames = [...new Set(matches.map((m) => m.group))].sort()
  const predictedCount = matches.filter((m) => m.pick).length

  const groups = groupNames.map((g) => {
    const gMatches = matches.filter((m) => m.group === g)
    const acc = new Map<string, Acc>()
    const team = (n: string) => {
      if (!acc.has(n)) acc.set(n, blank(n, g))
      return acc.get(n)!
    }
    // Touch every team so unplayed groups still list all four.
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
      if (m.pick === 'H') {
        h.w++
        h.pts += 3
        a.l++
      } else if (m.pick === 'A') {
        a.w++
        a.pts += 3
        h.l++
      } else {
        h.d++
        a.d++
        h.pts++
        a.pts++
      }
    }

    const rows = [...acc.values()].sort((x, y) => {
      if (y.pts !== x.pts) return y.pts - x.pts
      if (y.w !== x.w) return y.w - x.w
      // Head-to-head among the teams tied on pts+wins.
      const tiedNames = [...acc.values()]
        .filter((t) => t.pts === x.pts && t.w === x.w)
        .map((t) => t.name)
      if (tiedNames.length > 1) {
        const hh = h2hPoints(tiedNames, gMatches)
        const dx = (hh.get(y.name) || 0) - (hh.get(x.name) || 0)
        if (dx !== 0) return dx
      }
      return x.name.localeCompare(y.name)
    })

    const teams: TeamRow[] = rows.map((r, i) => {
      const sharesWithNeighbour =
        rows.some((o) => o !== r && o.pts === r.pts && o.w === r.w)
      return {
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
        tied: sharesWithNeighbour,
      }
    })
    const complete = gMatches.length > 0 && gMatches.every((m) => m.pick)
    return { group: g, complete, teams }
  })

  // Rank the third-placed teams across all groups; best 8 qualify.
  const thirdsRaw = groups
    .map((g) => g.teams[2])
    .filter(Boolean)
    .map((t) => ({ name: t!.name, group: t!.group, pts: t!.pts, w: t!.w, played: t!.played }))

  const thirdsSorted = [...thirdsRaw].sort(
    (a, b) => b.pts - a.pts || b.w - a.w || a.name.localeCompare(b.name),
  )

  const thirds: ThirdRow[] = thirdsSorted.map((t, i) => ({
    ...t,
    qualifies: i < 8,
    tied: thirdsSorted.some(
      (o, j) => j !== i && o.pts === t.pts && o.w === t.w,
    ),
  }))

  const advancing: Projection['advancing'] = []
  for (const g of groups) {
    for (const t of g.teams) if (t.advances) advancing.push({ name: t.name, group: g.group, via: 'top2' })
  }
  for (const t of thirds) if (t.qualifies) advancing.push({ name: t.name, group: t.group, via: 'third' })

  return {
    groups,
    thirds,
    advancing,
    predictedCount,
    totalGames: matches.length,
    complete: predictedCount === matches.length && matches.length > 0,
  }
}
