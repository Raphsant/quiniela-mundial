// Pure, framework-agnostic scoring logic.
// Predictions are outcome-only (1/X/2). A correct outcome scores `hit` points.

export type Outcome = 'H' | 'D' | 'A' // Home win / Draw / Away win

export function outcome(home: number, away: number): Outcome {
  if (home > away) return 'H'
  if (home < away) return 'A'
  return 'D'
}

// Which side advances given a scoreline: goals decide, else the chosen `advancer`
// (penalties). Mirrors bracket.realAdvanceSide but works on raw numbers — used for
// the new knockout bracket's predicted scorelines (propagation + scoring).
export function sideFromScore(
  homeGoals: number,
  awayGoals: number,
  advancer?: 'H' | 'A' | null,
): 'H' | 'A' | null {
  if (homeGoals > awayGoals) return 'H'
  if (awayGoals > homeGoals) return 'A'
  return advancer === 'H' || advancer === 'A' ? advancer : null
}

// New knockout bracket scoring: exact scoreline beats correct-winner beats miss.
export interface KoScoreConfig {
  exact: number // both goal counts correct
  winner: number // correct advancing side only
}

export function scoreKnockout(
  pred: { homeGoals: number; awayGoals: number; advancer?: 'H' | 'A' | null },
  real: { homeGoals: number; awayGoals: number; advancer?: 'H' | 'A' | null },
  cfg: KoScoreConfig,
): number {
  if (pred.homeGoals === real.homeGoals && pred.awayGoals === real.awayGoals) return cfg.exact
  const ps = sideFromScore(pred.homeGoals, pred.awayGoals, pred.advancer)
  const rs = sideFromScore(real.homeGoals, real.awayGoals, real.advancer)
  return ps && rs && ps === rs ? cfg.winner : 0
}

export interface ScoreConfig {
  hit: number // points for a correct outcome pick
}

export const DEFAULT_SCORING: ScoreConfig = { hit: 1 }

export interface PredScore {
  correctOutcome: boolean
  points: number
}

export function scorePrediction(
  predOutcome: Outcome,
  actual: { homeGoals: number; awayGoals: number },
  cfg: ScoreConfig = DEFAULT_SCORING,
): PredScore {
  const correctOutcome = predOutcome === outcome(actual.homeGoals, actual.awayGoals)
  return { correctOutcome, points: correctOutcome ? cfg.hit : 0 }
}
