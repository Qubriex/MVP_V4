// scripts/migrate.js — apply pending migrations (npm run migrate).
import 'dotenv/config';
import { migrate } from '../core/db/migrate.js';
import { close } from '../core/db/dal.js';

const applied = await migrate();
console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'Database is up to date.');
close();
