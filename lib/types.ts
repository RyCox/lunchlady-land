import type { Category, CreditableKey, MealCountKey, PlannedKey } from "./constants";

export type Role = "admin" | "manager";

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  school_id: number | null;
  school_name: string | null;
}

export interface School {
  id: number;
  name: string;
  code: string;
}

export type FoodItem = {
  id: number;
  item_no: string;
  description: string;
  haccp: string;
  portion_size: string;
  category: Category;
  unit: string;
  source: string;
  active: boolean;
} & Record<CreditableKey, number>;

export interface Menu {
  id: number;
  menu_no: number;
  name: string;
  meal: "breakfast" | "lunch";
  active: boolean;
}

export type MenuItem = {
  id: number;
  menu_id: number;
  food_item_id: number;
  item_no: string;
  description: string;
  category: Category;
  sort: number;
} & Record<PlannedKey, number>;

export type ProductionRecord = {
  id: number;
  school_id: number;
  school_name: string;
  record_date: string;
  meal: "breakfast" | "lunch";
  menu_id: number | null;
  menu_no: number | null;
  menu_name: string;
  prepared_by: string;
  offer_vs_serve: boolean;
  ovs_reason: string;
  count_notes: string;
  status: "draft" | "finalized";
  version: number;
  finalized_at: string | null;
  finalized_by_name: string | null;
} & Record<MealCountKey, number>;

export interface PullSheetLine {
  prepared_by_initials: string;
  qty_pulled: string;
  temp1: number | null;
  temp2: number | null;
  amount_prepared: number | null;
  amount_used: number | null;
  amount_leftover: number | null;
  leftover_code: string;
}

export type RecordLine = {
  id: number;
  record_id: number;
  food_item_id: number | null;
  item_no: string;
  description: string;
  haccp: string;
  portion_size: string;
  category: Category;
  unit: string;
  source: string;
  amt_prepared: string;
  num_prepared: number | null;
  num_served: number | null;
  num_sold_alc: number | null;
  amt_leftover: number | null;
  code: string;
  sort: number;
  ps: PullSheetLine;
} & Record<CreditableKey, number> &
  Record<PlannedKey, number>;

export interface RecordWithLines {
  record: ProductionRecord;
  lines: RecordLine[];
}
