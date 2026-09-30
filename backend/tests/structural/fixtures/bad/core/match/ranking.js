// Fixture: a comment mentioning core/match/* must not hide the import below.
import { retrieveLearnerContext } from '../stores/learnerMemoryStore.js';
/** a block comment */
export const rank = () => retrieveLearnerContext();
