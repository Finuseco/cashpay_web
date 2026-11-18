'use strict';

const USER_FIELDS = 'id, id_wallet, full_name, first_name, email, phone, pin_hash, notifications_channel, role, status';

function createAuthStore(db) {
  const transactionAdapter = connection => ({
    async incrementRate(keyHash, at, windowMs) {
      const cutoff = new Date(at.getTime() - windowMs);
      const { rows } = await connection.query(`
        INSERT INTO main_auth_rate_limits (key_hash, window_started_at, attempts)
        VALUES ($1, $2, 1)
        ON CONFLICT (key_hash) DO UPDATE SET
          attempts = CASE WHEN main_auth_rate_limits.window_started_at <= $3 THEN 1 ELSE main_auth_rate_limits.attempts + 1 END,
          window_started_at = CASE WHEN main_auth_rate_limits.window_started_at <= $3 THEN $2 ELSE main_auth_rate_limits.window_started_at END
        RETURNING attempts`, [keyHash, at, cutoff]);
      return rows[0].attempts;
    },
    async findUserByWallet(walletId) {
      const { rows } = await connection.query(`SELECT ${USER_FIELDS} FROM users WHERE id_wallet = $1::text FOR UPDATE`, [walletId]);
      return rows[0] || null;
    },
    async invalidateChallenges(userId, at) {
      await connection.query('UPDATE main_auth_challenges SET consumed_at = $2 WHERE user_id = $1::integer AND consumed_at IS NULL', [userId, at]);
    },
    async insertChallenge(row) {
      await connection.query(`INSERT INTO main_auth_challenges
        (id, user_id, token_hash, otp_hash, audience, channel, expires_at)
        VALUES ($1, $2::integer, $3, $4, $5, $6, $7)`, [row.id, row.user_id, row.token_hash, row.otp_hash, row.audience, row.channel, row.expires_at]);
    },
    async lockChallenge(hash) {
      const { rows: identity } = await connection.query('SELECT user_id FROM main_auth_challenges WHERE token_hash = $1', [hash]);
      if (!identity[0]) return null;
      // All paths lock the user first, then the challenge: start and PIN cannot deadlock.
      const { rows: users } = await connection.query(`SELECT ${USER_FIELDS} FROM users WHERE id = $1::integer FOR UPDATE`, [identity[0].user_id]);
      const { rows } = await connection.query('SELECT * FROM main_auth_challenges WHERE token_hash = $1 FOR UPDATE', [hash]);
      return rows[0] ? { ...rows[0], user: users[0] || null } : null;
    },
    async updateChallenge(id, changes) {
      const allowed = ['otp_attempts', 'pin_attempts', 'otp_verified_at', 'consumed_at'];
      const columns = Object.keys(changes);
      if (!columns.length || columns.some(column => !allowed.includes(column))) throw new Error('Invalid challenge update');
      await connection.query(`UPDATE main_auth_challenges SET ${columns.map((column, index) => `${column} = $${index + 2}`).join(', ')} WHERE id = $1`, [id, ...columns.map(column => changes[column])]);
    },
    async insertSession(row) {
      await connection.query('INSERT INTO main_auth_sessions (id, user_id, token_hash, audience, expires_at) VALUES ($1, $2::integer, $3, $4, $5)', [row.id, row.user_id, row.token_hash, row.audience, row.expires_at]);
    },
  });

  return {
    async transaction(callback) {
      const connection = await db.getConnection();
      try {
        await connection.query('BEGIN');
        const result = await callback(transactionAdapter(connection));
        await connection.query('COMMIT');
        return result;
      } catch (error) {
        await connection.query('ROLLBACK');
        throw error;
      } finally {
        connection.release();
      }
    },
    async revokeChallenge(id, at) {
      await db.query('UPDATE main_auth_challenges SET consumed_at = $2 WHERE id = $1', [id, at]);
    },
    async revokeChallengeByToken(hash, at) {
      await db.query('UPDATE main_auth_challenges SET consumed_at = $2 WHERE token_hash = $1', [hash, at]);
    },
    async findSession(hash) {
      const { rows } = await db.query(`SELECT s.*, json_build_object(
        'id', u.id, 'id_wallet', u.id_wallet, 'full_name', u.full_name, 'role', u.role, 'status', u.status
      ) AS "user" FROM main_auth_sessions s INNER JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1`, [hash]);
      return rows[0] || null;
    },
    async revokeSession(hash, at) {
      await db.query('UPDATE main_auth_sessions SET revoked_at = $2 WHERE token_hash = $1', [hash, at]);
    },
  };
}

module.exports = { createAuthStore };
