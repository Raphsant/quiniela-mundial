import mongoose, { Schema, model, type InferSchemaType } from 'mongoose'

// A user's manual resolution of a points tie that the real tournament would
// settle on goal difference (which this quiniela doesn't track).
//   scope: group letter "A".."L", or "THIRDS" for the best-third cutoff.
//   order: tied team names in the user's chosen finishing order (1st → last).
const tiebreakSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    scope: { type: String, required: true },
    order: { type: [String], default: [] },
  },
  { timestamps: true },
)

tiebreakSchema.index({ user: 1, scope: 1 }, { unique: true })

export type TiebreakDoc = InferSchemaType<typeof tiebreakSchema>
export const Tiebreak = mongoose.models.Tiebreak || model('Tiebreak', tiebreakSchema)
