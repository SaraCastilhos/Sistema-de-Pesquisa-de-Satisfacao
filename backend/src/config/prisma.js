const { PrismaClient } = require('@prisma/client');

// Instância única por processo, para não esgotar o limite de conexões do Neon
const prisma = new PrismaClient();

module.exports = { prisma };
