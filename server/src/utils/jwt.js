import jwt from 'jsonwebtoken';

/**
 * Validates and retrieves the active JWT secret.
 * In every environment, strictly requires JWT_SECRET from environment with >= 32 characters.
 */
export const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;

  if (!secret || typeof secret !== 'string' || secret.trim().length < 32) {
    throw new Error(
      'FATAL SECURITY ERROR: JWT_SECRET environment variable is missing or insecure. JWT_SECRET must be explicitly defined and at least 32 characters long in all environments.'
    );
  }

  return secret.trim();
};

const DEFAULT_JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Generate a signed JWT token for a user
 * @param {Object} payload - { userId, username }
 * @param {string} [expiresIn] - Expiration duration string (e.g. '7d', '1h', '-1s')
 * @returns {string} Signed JWT token
 */
export const generateToken = (payload, expiresIn = DEFAULT_JWT_EXPIRES_IN) => {
  const secret = getJwtSecret();
  return jwt.sign(payload, secret, { expiresIn });
};

/**
 * Verify and decode a JWT token
 * @param {string} token - JWT token string
 * @returns {Object|null} Decoded payload or null if invalid/expired
 */
export const verifyToken = (token) => {
  if (!token || typeof token !== 'string') return null;
  try {
    const secret = getJwtSecret();
    return jwt.verify(token, secret);
  } catch (err) {
    return null;
  }
};
