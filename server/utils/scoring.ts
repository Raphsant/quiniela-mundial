// Pure, framework-agnostic scoring logic.
// Predictions are outcome-only (1/X/2). A correct outcome scores `hit` points.

export type Outcome = 'H' | 'D' | 'A' // Home win / Draw / Away win

export function outcome(home: number, away: number): Outcome {
  if (home > away) return 'H'
  if (home < away) return 'A'
  return 'D'
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
