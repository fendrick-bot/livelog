import { defineConfig } from 'drizzle-kit';

for (const file of ['.env', '../../.env']) {
  try {
    process.loadEnvFile(file);
    break;
  } catch {
    // file not present: fall through to the next candidate
  }
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://livelog:livelog@localhost:5432/livelog',
  },
  strict: true,
  verbose: true,
});
