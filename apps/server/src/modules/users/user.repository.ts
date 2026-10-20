import { count, eq } from 'drizzle-orm';
import { users, type NewUserRow, type UserRow } from '../../db/schema';
import type { DbExecutor } from '../../db/types';

export class UserRepository {
  constructor(private readonly db: DbExecutor) {}

  async findById(id: string): Promise<UserRow | null> {
    const [row] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return row ?? null;
  }

  async findByEmail(email: string): Promise<UserRow | null> {
    const [row] = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
    return row ?? null;
  }

  async create(values: NewUserRow): Promise<UserRow> {
    const [row] = await this.db.insert(users).values(values).returning();
    if (!row) throw new Error('Failed to insert user');
    return row;
  }

  async touchLogin(id: string): Promise<void> {
    await this.db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, id));
  }

  async countAll(): Promise<number> {
    const [row] = await this.db.select({ value: count() }).from(users);
    return row?.value ?? 0;
  }
}
