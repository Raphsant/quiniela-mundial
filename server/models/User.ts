import mongoose, { Schema, model, type InferSchemaType } from 'mongoose'

const userSchema = new Schema(
  {
    username: { type: String, required: true, unique: true, index: true }, // stored lowercase
    passwordHash: { type: String, required: true },
    displayName: { type: String, default: '' }, // shown in the UI; falls back to username
    isAdmin: { type: Boolean, default: false },
    paid: { type: Boolean, default: false }, // informational only; payment handled externally
  },
  { timestamps: true },
)

export type UserDoc = InferSchemaType<typeof userSchema>
export const User = mongoose.models.User || model('User', userSchema)
