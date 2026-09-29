// db/init.js — compatibility shim.
// The schema now lives in migrations/ and is applied by core/db/migrate.js;
// connections come from core/db/dal.js. Legacy route code keeps calling
// getDb() and db.close(); both are safe against the shared connection.
import * as dal from '../core/db/dal.js';
import { migrate } from '../core/db/migrate.js';

const getDb = () => dal.legacyHandle();
const initDb = () => migrate();

export { getDb, initDb };
