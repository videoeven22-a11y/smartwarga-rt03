import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// In development, clear cached PrismaClient to pick up new models
// This is necessary when new models are added to the schema
if (process.env.NODE_ENV !== 'production' && globalForPrisma.prisma) {
  // Check if the cached client has syncConfig model
  // If not, we need to recreate it
  const client = globalForPrisma.prisma as any
  if (!client.syncConfig) {
    globalForPrisma.prisma = undefined
  }
}

export const db = globalForPrisma.prisma ?? new PrismaClient({
  log: ['query'],
})

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}