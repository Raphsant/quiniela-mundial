import mongoose, { Schema, model, type InferSchemaType } from 'mongoose'

const predictionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    match: { type: Schema.Types.ObjectId, ref: 'Match', required: true },
    // Outcome pick only — no scorelines. 'H' = home win, 'D' = draw, 'A' = away win.
    // Knockout matches never use 'D' (someone must advance).
    outcome: { type: String, enum: ['H', 'D', 'A'], required: true },
  },
  { timestamps: true },
)

// One prediction per user per match.
predictionSchema.index({ user: 1, match: 1 }, { unique: true })

export type PredictionDoc = InferSchemaType<typeof predictionSchema>
export const Prediction = mongoose.models.Prediction || model('Prediction', predictionSchema)
