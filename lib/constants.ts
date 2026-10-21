// Shared by server and client code.

export const CREDITABLE = [
  ["cr_mma", "MMA"],
  ["cr_grain", "Grain"],
  ["cr_vbp", "V-BP"],
  ["cr_vdg", "V-DG"],
  ["cr_vot", "V-OT"],
  ["cr_vro", "V-RO"],
  ["cr_vst", "V-ST"],
  ["cr_vad", "V-AD"],
  ["cr_fruit", "Fruit"],
  ["cr_milk", "Milk"],
] as const;

export const PLANNED = [
  ["planned_pk", "PK"],
  ["planned_k5", "K-5"],
  ["planned_k8", "K-8"],
  ["planned_912", "9-12"],
  ["planned_other", "Other"],
] as const;

export const MEAL_COUNTS = [
  ["count_pk", "PK"],
  ["count_k5", "K-5"],
  ["count_k8", "K-8"],
  ["count_912", "9-12"],
  ["count_adults", "Adults"],
  ["count_staff", "Cafe Staff"],
] as const;

export const CATEGORIES = [
  ["general", "General"],
  ["fruit", "Fruit"],
  ["milk", "Milk"],
  ["condiment", "Condiments"],
] as const;

export const UNITS = ["case", "can", "lb", "bag", "each", "recipe"] as const;

export const LEFTOVER_CODES = [
  ["F", "Frozen"],
  ["R", "Refrigerated"],
  ["SND", "Served next day"],
  ["D", "Discarded"],
] as const;

export const HACCP = [
  ["1", "1 - No cook"],
  ["2", "2 - Same day service"],
  ["3", "3 - Complex"],
] as const;

export type Category = (typeof CATEGORIES)[number][0];
export type CreditableKey = (typeof CREDITABLE)[number][0];
export type PlannedKey = (typeof PLANNED)[number][0];
export type MealCountKey = (typeof MEAL_COUNTS)[number][0];
