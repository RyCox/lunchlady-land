import "server-only";
import { CREDITABLE, PLANNED } from "./constants";
import { getDb, withTx } from "./db";
import { AppError } from "./records";
import type { FoodItem, Menu, MenuItem, School, User } from "./types";

function assertAdmin(user: User) {
  if (user.role !== "admin") throw new AppError("Only district admins can change the catalog.");
}

const toItem = (row: Record<string, unknown>) => {
  const item = { ...row };
  for (const [k] of CREDITABLE) item[k] = Number(row[k]);
  return item as unknown as FoodItem;
};

export async function listFoodItems(opts: { activeOnly?: boolean } = {}) {
  const db = await getDb();
  const { rows } = await db.query(
    `select * from food_items ${opts.activeOnly ? "where active" : ""}
     order by case category when 'general' then 0 when 'fruit' then 1 when 'milk' then 2 else 3 end, item_no`);
  return rows.map(toItem);
}

export async function getFoodItem(id: number) {
  const db = await getDb();
  const { rows } = await db.query("select * from food_items where id = $1", [id]);
  return rows[0] ? toItem(rows[0]) : null;
}

export type FoodItemInput = Omit<FoodItem, "id">;
const ITEM_FIELDS = ["item_no", "description", "haccp", "portion_size", "category", "unit", "source", "active", ...CREDITABLE.map(([k]) => k)] as const;

export async function saveFoodItem(user: User, id: number | null, input: FoodItemInput) {
  assertAdmin(user);
  if (!input.item_no.trim() || !input.description.trim()) throw new AppError("Item # and description are required.");
  return withTx(user.id, async (tx) => {
    const dup = await tx.query("select id from food_items where item_no = $1 and id <> $2", [input.item_no, id ?? 0]);
    if (dup.rows.length) throw new AppError(`Item # ${input.item_no} is already used.`);
    const values = ITEM_FIELDS.map((f) => input[f]);
    if (id) {
      await tx.query(`update food_items set ${ITEM_FIELDS.map((f, i) => `${f} = $${i + 2}`).join(", ")} where id = $1`, [id, ...values]);
      return id;
    }
    const { rows } = await tx.query<{ id: number }>(
      `insert into food_items (${ITEM_FIELDS.join(", ")}) values (${ITEM_FIELDS.map((_, i) => `$${i + 1}`).join(", ")}) returning id`, values);
    return rows[0].id;
  });
}

export async function listMenus(opts: { activeOnly?: boolean } = {}) {
  const db = await getDb();
  const { rows } = await db.query<Menu & { item_count: number }>(
    `select m.*, (select count(*)::int from menu_items i where i.menu_id = m.id) as item_count
     from menus m ${opts.activeOnly ? "where m.active" : ""} order by m.meal desc, m.menu_no`);
  return rows;
}

export async function getMenu(id: number) {
  const db = await getDb();
  const menu = (await db.query<Menu>("select * from menus where id = $1", [id])).rows[0];
  if (!menu) return null;
  const { rows } = await db.query<MenuItem>(
    `select i.*, f.item_no, f.description, f.category from menu_items i join food_items f on f.id = i.food_item_id
     where i.menu_id = $1 order by case f.category when 'general' then 0 when 'fruit' then 1 when 'milk' then 2 else 3 end, i.sort, i.id`, [id]);
  return { menu, items: rows };
}

export async function saveMenu(user: User, id: number | null, input: Omit<Menu, "id">) {
  assertAdmin(user);
  if (!input.name.trim() || !Number.isInteger(input.menu_no)) throw new AppError("Menu # and name are required.");
  return withTx(user.id, async (tx) => {
    const dup = await tx.query("select id from menus where menu_no = $1 and id <> $2", [input.menu_no, id ?? 0]);
    if (dup.rows.length) throw new AppError(`Menu # ${input.menu_no} is already used.`);
    if (id) {
      await tx.query("update menus set menu_no = $2, name = $3, meal = $4, active = $5 where id = $1",
        [id, input.menu_no, input.name, input.meal, input.active]);
      return id;
    }
    const { rows } = await tx.query<{ id: number }>(
      "insert into menus (menu_no, name, meal, active) values ($1, $2, $3, $4) returning id",
      [input.menu_no, input.name, input.meal, input.active]);
    return rows[0].id;
  });
}

export async function saveMenuItems(user: User, menuId: number, items: ({ id: number } & Record<(typeof PLANNED)[number][0], number>)[]) {
  assertAdmin(user);
  await withTx(user.id, async (tx) => {
    for (const item of items)
      await tx.query(
        `update menu_items set ${PLANNED.map(([k], i) => `${k} = $${i + 3}`).join(", ")} where id = $1 and menu_id = $2`,
        [item.id, menuId, ...PLANNED.map(([k]) => item[k])]);
  });
}

export async function addMenuItem(user: User, menuId: number, foodItemId: number) {
  assertAdmin(user);
  await withTx(user.id, async (tx) => {
    const dup = await tx.query("select id from menu_items where menu_id = $1 and food_item_id = $2", [menuId, foodItemId]);
    if (dup.rows.length) throw new AppError("That item is already on the menu.");
    await tx.query(
      "insert into menu_items (menu_id, food_item_id, sort) values ($1, $2, (select coalesce(max(sort), 0) + 1 from menu_items where menu_id = $1))",
      [menuId, foodItemId]);
  });
}

export async function removeMenuItem(user: User, menuId: number, menuItemId: number) {
  assertAdmin(user);
  await withTx(user.id, (tx) => tx.query("delete from menu_items where id = $1 and menu_id = $2", [menuItemId, menuId]));
}

export async function listSchools() {
  const db = await getDb();
  return (await db.query<School>("select * from schools order by name")).rows;
}

export async function listUsers() {
  const db = await getDb();
  return (await db.query<User>(
    `select u.id, u.name, u.email, u.role, u.school_id, s.name as school_name
     from users u left join schools s on s.id = u.school_id order by u.role, u.name`)).rows;
}

export async function addSchool(user: User, name: string, code: string) {
  assertAdmin(user);
  if (!name.trim() || !code.trim()) throw new AppError("School name and code are required.");
  await withTx(user.id, (tx) => tx.query("insert into schools (name, code) values ($1, $2)", [name.trim(), code.trim().toUpperCase()]));
}

export async function addUser(user: User, input: { name: string; email: string; role: "admin" | "manager"; schoolId: number | null }) {
  assertAdmin(user);
  if (!input.name.trim() || !input.email.trim()) throw new AppError("Name and email are required.");
  if (input.role === "manager" && !input.schoolId) throw new AppError("A cafeteria manager needs a school.");
  await withTx(user.id, (tx) => tx.query("insert into users (name, email, role, school_id) values ($1, $2, $3, $4)",
    [input.name.trim(), input.email.trim().toLowerCase(), input.role, input.role === "admin" ? null : input.schoolId]));
}

export async function listAudit(user: User, opts: { limit?: number; recordId?: number } = {}) {
  assertAdmin(user);
  const db = await getDb();
  const { rows } = await db.query<{ id: number; at: string; user_name: string | null; table_name: string; row_id: number; action: string; old_value: unknown; new_value: unknown; reason: string | null }>(
    `select a.id, a.at::text as at, u.name as user_name, a.table_name, a.row_id, a.action, a.old_value, a.new_value, a.reason
     from audit_events a left join users u on u.id = a.user_id
     ${opts.recordId ? `where (a.table_name = 'production_records' and a.row_id = $1)
        or (a.table_name = 'production_record_lines' and (coalesce(a.new_value, a.old_value)->>'record_id')::int = $1)` : ""}
     order by a.id desc limit ${opts.limit ?? 200}`, opts.recordId ? [opts.recordId] : []);
  return rows;
}
