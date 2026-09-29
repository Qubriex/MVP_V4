// Fixture: employer routes reaching learner memory, and naming a session table.
import { retrieveLearnerContext } from '../../core/stores/learnerMemoryStore.js';
export const peek = () => retrieveLearnerContext('SELECT * FROM session_messages');
