import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "./db";
import type { User } from "./types";

// POC sign-in: pick a seeded user and get a signed cookie. Production swaps
// this for Supabase Auth with the district's Google or Microsoft accounts.

const COOKIE = "ll_session";

function secret() {
  return process.env.SESSION_SECRET || "lunchlady-land-dev-secret";
}

function sign(userId: number) {
  const mac = crypto.createHmac("sha256", secret()).update(String(userId)).digest("hex");
  return `${userId}.${mac}`;
}

function verify(token: string | undefined): number | null {
  if (!token) return null;
  const [id] = token.split(".");
  const expected = sign(Number(id));
  if (token.length !== expected.length) return null;
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected)) ? Number(id) : null;
}

export async function getUserById(id: number): Promise<User | null> {
  const db = await getDb();
  const { rows } = await db.query<User>(
    `select u.id, u.name, u.email, u.role, u.school_id, s.name as school_name
     from users u left join schools s on s.id = u.school_id where u.id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function currentUser(): Promise<User | null> {
  const id = verify((await cookies()).get(COOKIE)?.value);
  return id == null ? null : getUserById(id);
}

export async function requireUser(): Promise<User> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/");
  return user;
}

export async function signIn(userId: number) {
  (await cookies()).set(COOKIE, sign(userId), { httpOnly: true, sameSite: "lax", path: "/" });
}

export async function signOut() {
  (await cookies()).delete(COOKIE);
}

/** Managers only see their own school; admins see every school. */
export function canAccessSchool(user: User, schoolId: number) {
  return user.role === "admin" || user.school_id === schoolId;
}
