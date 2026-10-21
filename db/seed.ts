import type { Queryable } from "@/lib/db";

// Sample district data so the POC is usable on first run.
// HACCP: 1 = no cook, 2 = same day service, 3 = complex food preparation.

const schools = [
  ["Maple Elementary", "MAP"],
  ["Riverside K-8", "RIV"],
  ["Central High", "CHS"],
];

const users: [string, string, "admin" | "manager", string | null][] = [
  ["Dana District", "dana@district.example", "admin", null],
  ["Maria Lopez", "maria@district.example", "manager", "MAP"],
  ["Jim Carter", "jim@district.example", "manager", "RIV"],
  ["Pat Nguyen", "pat@district.example", "manager", "CHS"],
];

type Item = {
  no: string; desc: string; haccp: string; portion: string;
  cat: "general" | "fruit" | "milk" | "condiment"; unit: string; source: string;
  mma?: number; grain?: number; vbp?: number; vdg?: number; vot?: number;
  vro?: number; vst?: number; vad?: number; fruit?: number; milk?: number;
};

const items: Item[] = [
  { no: "1001", desc: "Chicken Nuggets, whole grain breaded", haccp: "2", portion: "5 pc", cat: "general", unit: "case", source: "CN label", mma: 2, grain: 1 },
  { no: "1002", desc: "Cheese Pizza, whole grain crust", haccp: "2", portion: "1 slice", cat: "general", unit: "case", source: "CN label", mma: 2, grain: 2, vro: 0.125 },
  { no: "1003", desc: "Beef Taco Meat", haccp: "3", portion: "#8 scoop", cat: "general", unit: "recipe", source: "Recipe R-114", mma: 2 },
  { no: "1004", desc: "Whole Grain Tortilla, 8 in", haccp: "1", portion: "1 each", cat: "general", unit: "case", source: "PFS", grain: 1.5 },
  { no: "1005", desc: "Brown Rice", haccp: "2", portion: "1/2 cup", cat: "general", unit: "bag", source: "Recipe R-020", grain: 1 },
  { no: "1006", desc: "Black Beans, seasoned", haccp: "2", portion: "1/2 cup", cat: "general", unit: "can", source: "Recipe R-031", vbp: 0.5 },
  { no: "1007", desc: "Steamed Broccoli", haccp: "2", portion: "1/2 cup", cat: "general", unit: "bag", source: "FBG", vdg: 0.5 },
  { no: "1008", desc: "Baby Carrots", haccp: "1", portion: "1/2 cup", cat: "general", unit: "bag", source: "FBG", vro: 0.5 },
  { no: "1009", desc: "Corn, buttered", haccp: "2", portion: "1/2 cup", cat: "general", unit: "can", source: "FBG", vst: 0.5 },
  { no: "1010", desc: "Romaine Side Salad", haccp: "1", portion: "1 cup", cat: "general", unit: "bag", source: "FBG", vdg: 0.5 },
  { no: "1011", desc: "Whole Grain Pancakes", haccp: "2", portion: "2 each", cat: "general", unit: "case", source: "CN label", grain: 2 },
  { no: "1012", desc: "Turkey Sausage Patty", haccp: "2", portion: "1 each", cat: "general", unit: "case", source: "CN label", mma: 1 },
  { no: "1013", desc: "Cereal, whole grain, bowl", haccp: "1", portion: "1 bowl", cat: "general", unit: "case", source: "PFS", grain: 1 },
  { no: "1014", desc: "Yogurt, low fat", haccp: "1", portion: "4 oz", cat: "general", unit: "case", source: "FBG", mma: 1 },
  { no: "2001", desc: "Apple, fresh", haccp: "1", portion: "1 each (1/2 cup)", cat: "fruit", unit: "case", source: "FBG", fruit: 0.5 },
  { no: "2002", desc: "Mandarin Oranges, canned", haccp: "1", portion: "1/2 cup", cat: "fruit", unit: "can", source: "FBG", fruit: 0.5 },
  { no: "2003", desc: "Banana, fresh", haccp: "1", portion: "1 each (1/2 cup)", cat: "fruit", unit: "case", source: "FBG", fruit: 0.5 },
  { no: "2004", desc: "100% Orange Juice", haccp: "1", portion: "4 oz", cat: "fruit", unit: "case", source: "FBG", fruit: 0.5 },
  { no: "3001", desc: "1% White Milk", haccp: "1", portion: "8 fl oz", cat: "milk", unit: "case", source: "FBG", milk: 1 },
  { no: "3002", desc: "Fat Free Chocolate Milk", haccp: "1", portion: "8 fl oz", cat: "milk", unit: "case", source: "FBG", milk: 1 },
  { no: "3003", desc: "Fat Free White Milk", haccp: "1", portion: "8 fl oz", cat: "milk", unit: "case", source: "FBG", milk: 1 },
  { no: "4001", desc: "Ketchup Packet", haccp: "1", portion: "1 pkt", cat: "condiment", unit: "case", source: "" },
  { no: "4002", desc: "Ranch Dressing Cup", haccp: "1", portion: "1 oz", cat: "condiment", unit: "case", source: "" },
  { no: "4003", desc: "Salsa Cup", haccp: "1", portion: "1 oz", cat: "condiment", unit: "case", source: "" },
  { no: "4004", desc: "Syrup Cup", haccp: "1", portion: "1 oz", cat: "condiment", unit: "case", source: "" },
];

// [menu_no, name, meal, [item_no, pk, k5, k8, 912, other][]]
const menus: [number, string, "breakfast" | "lunch", [string, number, number, number, number, number][]][] = [
  [101, "Nugget Day", "lunch", [
    ["1001", 20, 180, 0, 0, 10], ["1005", 20, 180, 0, 0, 10], ["1007", 20, 180, 0, 0, 10],
    ["1008", 20, 180, 0, 0, 10], ["2001", 20, 100, 0, 0, 5], ["2002", 0, 80, 0, 0, 5],
    ["3001", 10, 90, 0, 0, 5], ["3002", 10, 90, 0, 0, 5], ["4001", 20, 180, 0, 0, 10],
  ]],
  [102, "Taco Tuesday", "lunch", [
    ["1003", 0, 0, 220, 300, 15], ["1004", 0, 0, 220, 300, 15], ["1006", 0, 0, 220, 300, 15],
    ["1009", 0, 0, 220, 300, 15], ["1010", 0, 0, 220, 300, 15], ["2002", 0, 0, 220, 300, 15],
    ["2003", 0, 0, 0, 300, 0], ["3001", 0, 0, 110, 150, 8], ["3003", 0, 0, 110, 150, 7],
    ["4003", 0, 0, 220, 300, 15],
  ]],
  [103, "Pizza Friday", "lunch", [
    ["1002", 0, 0, 0, 350, 20], ["1010", 0, 0, 0, 350, 20], ["1008", 0, 0, 0, 350, 20],
    ["2001", 0, 0, 0, 350, 20], ["2004", 0, 0, 0, 350, 20], ["3001", 0, 0, 0, 175, 10],
    ["3002", 0, 0, 0, 175, 10], ["4002", 0, 0, 0, 350, 20],
  ]],
  [201, "Pancake Breakfast", "breakfast", [
    ["1011", 15, 120, 0, 0, 5], ["1012", 15, 120, 0, 0, 5], ["2003", 15, 120, 0, 0, 5],
    ["3001", 8, 60, 0, 0, 3], ["3002", 7, 60, 0, 0, 2], ["4004", 15, 120, 0, 0, 5],
  ]],
];

export async function seed(tx: Queryable) {
  const schoolIds = new Map<string, number>();
  for (const [name, code] of schools) {
    const { rows } = await tx.query<{ id: number }>(
      "insert into schools (name, code) values ($1, $2) returning id", [name, code]);
    schoolIds.set(code, rows[0].id);
  }
  for (const [name, email, role, code] of users) {
    await tx.query("insert into users (name, email, role, school_id) values ($1, $2, $3, $4)",
      [name, email, role, code ? schoolIds.get(code) : null]);
  }
  const itemIds = new Map<string, number>();
  for (const i of items) {
    const { rows } = await tx.query<{ id: number }>(
      `insert into food_items (item_no, description, haccp, portion_size, category, unit, source,
         cr_mma, cr_grain, cr_vbp, cr_vdg, cr_vot, cr_vro, cr_vst, cr_vad, cr_fruit, cr_milk)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) returning id`,
      [i.no, i.desc, i.haccp, i.portion, i.cat, i.unit, i.source, i.mma ?? 0, i.grain ?? 0,
        i.vbp ?? 0, i.vdg ?? 0, i.vot ?? 0, i.vro ?? 0, i.vst ?? 0, i.vad ?? 0, i.fruit ?? 0, i.milk ?? 0]);
    itemIds.set(i.no, rows[0].id);
  }
  for (const [no, name, meal, lines] of menus) {
    const { rows } = await tx.query<{ id: number }>(
      "insert into menus (menu_no, name, meal) values ($1, $2, $3) returning id", [no, name, meal]);
    let sort = 0;
    for (const [itemNo, pk, k5, k8, g912, other] of lines) {
      await tx.query(
        `insert into menu_items (menu_id, food_item_id, planned_pk, planned_k5, planned_k8, planned_912, planned_other, sort)
         values ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [rows[0].id, itemIds.get(itemNo), pk, k5, k8, g912, other, sort++]);
    }
  }
}
