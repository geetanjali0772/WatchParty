import crypto from 'crypto';

/**
 * Generate a 6-character uppercase alphanumeric room code.
 * Excludes characters easily confused visually (0, O, 1, I).
 */
export const generateRoomCode = () => {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let result = '';
  const randomBytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    result += chars[randomBytes[i] % chars.length];
  }
  return result;
};

