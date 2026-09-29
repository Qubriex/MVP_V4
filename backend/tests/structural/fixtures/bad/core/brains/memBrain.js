// Fixture: a teaching brain with a computed dynamic import.
const name = 'x';
export const load = () => import(`../evidence/${name}.js`);
