import { ensureMongo } from '../utils/db'

// Guarantee the DB connection is live before any API handler runs a query.
export default defineEventHandler(async (event) => {
  if (event.path?.startsWith('/api/')) {
    await ensureMongo()
  }
})
