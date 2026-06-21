// index.js — unified inventory search across categories.
import { hotels, activities, cruises } from "./adapters.js";

const TYPES = { hotel: hotels, activity: activities, cruise: cruises };

// search({ type, ...params }) -> normalized Option[] for that category.
export async function searchInventory({ type, ...params }) {
  const fn = TYPES[type];
  if (!fn) throw new Error(`type must be one of: ${Object.keys(TYPES).join(", ")}`);
  return { type, options: await fn(params) };
}

export const INVENTORY_TYPES = Object.keys(TYPES);
