import mongoose, { Schema, model, type InferSchemaType } from 'mongoose'

const matchSchema = new Schema(
  {
    code: { type: String, required: true, unique: true }, // e.g. "A-1", "R32-1"
    stage: {
      type: String,
      enum: ['group', 'r32', 'r16', 'qf', 'sf', 'third', 'final'],
      required: true,
    },
    group: { type: String, default: null }, // "A".."L" for group stage, null otherwise
    // Concrete teams. For knockout matches these stay null — the actual teams are
    // resolved from each user's own predictions via the `feed*` descriptors below.
    homeTeam: { type: String, default: null },
    awayTeam: { type: String, default: null },
    // Knockout feeder descriptors (null for group matches). Shapes:
    //   { t:'pos', n:1|2, g:'A' }          → group winner (1) / runner-up (2)
    //   { t:'third', g:['A','B','C','D','F'] } → a qualifying 3rd-placed team from one of these groups
    //   { t:'win', c:'R32-01' }            → winner of another knockout match (by code)
    //   { t:'lose', c:'SF-01' }            → loser of another knockout match (3rd-place play-off)
    feedHome: { type: Schema.Types.Mixed, default: null },
    feedAway: { type: Schema.Types.Mixed, default: null },
    kickoffAt: { type: Date, required: true }, // predictions lock at this instant (server clock)
    venue: {
      type: { stadium: String, city: String, tz: String },
      default: null,
    }, // host stadium + city + IANA timezone (for displaying local kickoff)

    homeGoals: { type: Number, default: null },
    awayGoals: { type: Number, default: null },
    // Knockout only: who went through when the entered score is level (i.e. the
    // match was decided on penalties). Null whenever the goals already decide.
    advancer: { type: String, enum: ['H', 'A'], default: null },
    status: { type: String, enum: ['scheduled', 'finished'], default: 'scheduled' },
  },
  { timestamps: true },
)

matchSchema.index({ kickoffAt: 1 })

export type MatchDoc = InferSchemaType<typeof matchSchema>
export const Match = mongoose.models.Match || model('Match', matchSchema)
