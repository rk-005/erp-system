import prisma from '../lib/prisma';

/**
 * Generates a unique challan number in format: CH-YYYY-NNNNN
 * e.g. CH-2026-00001
 *
 * Uses a database count to determine the sequence number.
 * Thread-safe: the UNIQUE constraint on challanNumber handles races.
 * If a collision occurs, the transaction will surface a P2002 error.
 */
export const generateChallanNumber = async (): Promise<string> => {
  const year = new Date().getFullYear();
  const prefix = `CH-${year}-`;

  // Count challans created this year to determine sequence
  const count = await prisma.challan.count({
    where: {
      challanNumber: {
        startsWith: prefix,
      },
    },
  });

  // Pad to 5 digits: 00001, 00002, etc.
  const sequence = String(count + 1).padStart(5, '0');
  return `${prefix}${sequence}`;
};
