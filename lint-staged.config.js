/** Runs on staged files before every commit (see .husky/pre-commit). */
export default {
  '*.{ts,tsx,js,mjs,cjs}': ['eslint --fix --max-warnings=0', 'prettier --write'],
  '*.{json,md,yml,yaml,css,html}': ['prettier --write'],
  // Schema edits must keep the migration folder consistent. The function form ignores file paths.
  'apps/server/src/db/schema/**/*.ts': () => 'npm run db:check --silent',
};
