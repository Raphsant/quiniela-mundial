import mongoose, { Schema, model, type InferSchemaType } from 'mongoose'

// A user's SCORELINE prediction for one knockout match in the new bracket
// (built on the actual qualified teams). Kept in its OWN collection so the old
// outcome-only `Prediction` data is never touched or overwritten.
//   homeGoals/awayGoals: predicted goals for each side of the tie.
//   advancer: who the user thinks advances when they predict a LEVEL score
//     (penalties) — 'H' | 'A'. Null whenever the predicted goals already decide.
const knockoutPredictionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    match: { type: Schema.Types.ObjectId, ref: 'Match', required: true },
    homeGoals: { type: Number, required: true },
    awayGoals: { type: Number, required: true },
    advancer: { type: String, enum: ['H', 'A'], default: null },
  },
  { timestamps: true },
)

// One scoreline prediction per user per match.
knockoutPredictionSchema.index({ user: 1, match: 1 }, { unique: true })

export type KnockoutPredictionDoc = InferSchemaType<typeof knockoutPredictionSchema>
export const KnockoutPrediction =
  mongoose.models.KnockoutPrediction || model('KnockoutPrediction', knockoutPredictionSchema)
