// migrations/0003_system_secrets.js — secrets a deployment generates for
// itself when none are configured (docs/decisions.md D-030). One row per
// secret, written once and never changed; every instance reads the same
// values. No route reads this table. Values set in the environment always
// take precedence.
import * as dal from '../core/db/dal.js';

export const id = '0003_system_secrets';

export async function up() {
  await dal.exec(`
    CREATE TABLE IF NOT EXISTS system_secrets (
      name TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TRIGGER system_secrets_no_update BEFORE UPDATE ON system_secrets FOR EACH ROW EXECUTE FUNCTION qbx_append_only();
  `);
}
