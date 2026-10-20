// Enforces Conventional Commits: type(scope)!: subject
import { readFileSync } from 'node:fs';

const file = process.argv[2];
const message = readFileSync(file, 'utf8').split('\n')[0].trim();
const TYPES = [
  'feat',
  'fix',
  'docs',
  'style',
  'refactor',
  'perf',
  'test',
  'build',
  'ci',
  'chore',
  'revert',
];
const pattern = new RegExp(`^(${TYPES.join('|')})(\\([a-z0-9-]+\\))?!?: .{3,100}$`);

if (message.startsWith('Merge ') || message.startsWith('Revert "') || pattern.test(message))
  process.exit(0);

console.error(`
✖ Commit message does not follow Conventional Commits:

    ${message}

  Expected:  <type>(<optional scope>): <subject>
  Types:     ${TYPES.join(', ')}
  Example:   feat(live): show reader count in the editor
`);
process.exit(1);
