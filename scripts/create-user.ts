/**
 * Create or update a login user.
 *
 *   npx tsx scripts/create-user.ts <username> <password> [--admin]
 *
 * Examples:
 *   npx tsx scripts/create-user.ts sunny 'Worldcup2026!' --admin
 *   npx tsx scripts/create-user.ts juan 'mipassword'
 *
 * Passwords are hashed with the same scrypt driver nuxt-auth-utils uses to
 * verify them (default options), so the resulting hash is login-compatible.
 */
import 'dotenv/config'
import mongoose from 'mongoose'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'
import { User } from '../server/models/User'

async function run() {
  const [, , rawUsername, password, ...flags] = process.argv
  if (!rawUsername || !password) {
    console.error('Usage: tsx scripts/create-user.ts <username> <password> [--admin]')
    process.exit(1)
  }
  const username = rawUsername.trim().toLowerCase()
  const isAdmin = flags.includes('--admin')

  const uri = process.env.NUXT_MONGOOSE_URI || process.env.NUXT_MONGO_URI || process.env.MONGODB_URI
  if (!uri) throw new Error('Set NUXT_MONGOOSE_URI before running')
  await mongoose.connect(uri)

  // Empty options => library defaults, matching nuxt-auth-utils' runtimeConfig.hash.scrypt ({}).
  const scrypt = new Scrypt({})
  const passwordHash = await scrypt.make(password)

  await User.updateOne(
    { username },
    {
      $set: { passwordHash, isAdmin },
      $setOnInsert: { username, displayName: rawUsername.trim() },
    },
    { upsert: true },
  )

  console.log(`User "${username}" saved${isAdmin ? ' (admin)' : ''}.`)
  await mongoose.disconnect()
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
