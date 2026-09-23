import { createClient } from "@supabase/supabase-js";
import { Employee, Item, DailyEntry } from "./types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://sadtinfdwucwrxlmwxov.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhZHRpbmZkd3Vjd3J4bG13eG92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1NTM4MDgsImV4cCI6MjEwNTEyOTgwOH0.jMtjOIBQIuv0N0Q4ms9LJ5ys3h3lfakND4pVQXNbU2w";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export function getSessionToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("ph_token") || "";
}

export function getCurrentUser(): Employee | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("ph_employee_v2");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function canSeeSales(emp?: Employee | null): boolean {
  const e = emp || getCurrentUser();
  if (!e) return false;
  if (e.role === "owner") return true;
  if (e.id === "emp_1" || e.id === "emp_2") return true;
  if (e.name && (e.name.includes("يزيد") || e.name.includes("حسن"))) return true;
  return false;
}

export async function loginWithPin(pin: string): Promise<{ token: string; employee: Employee }> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/login`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ p_pin: String(pin) })
  });

  if (!res.ok) {
    throw new Error("الرقم السري غير صحيح أو الحساب معطل");
  }

  const data = await res.json();
  const emp = data.employee || {};

  const ROSTER_NAMES: Record<string, string> = {
    emp_1: "أ.يزيد",
    emp_2: "حسن",
    emp_3: "الشيف عصام",
    emp_4: "أبو يونس",
    emp_5: "العامودي",
    emp_6: "محمد البلول",
    emp_7: "غالب"
  };

  const finalName = ROSTER_NAMES[emp.id] || emp.name || "موظف";
  const isBranchStaff = emp.id === "emp_6" || emp.id === "emp_7" || emp.role === "employee" || emp.role === "branch_staff";
  const finalRole: Employee["role"] = isBranchStaff ? "branch_staff" : (emp.role || "employee");

  const employee: Employee = {
    id: emp.id,
    name: finalName,
    role: finalRole,
    branches: isBranchStaff ? ["عبداللطيف جميل"] : (emp.branches || "").split(",").map((s: string) => s.trim()).filter(Boolean)
  };

  if (typeof window !== "undefined") {
    localStorage.setItem("ph_token", data.token);
    localStorage.setItem("ph_employee_v2", JSON.stringify(employee));
  }

  return { token: data.token, employee };
}

export async function fetchItems(): Promise<Item[]> {
  const token = getSessionToken();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/items?select=*&active=eq.true&order=sort_order.asc`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "x-session-token": token
    }
  });

  if (!res.ok) return [];
  const rows = await res.json();
  return (rows || []).map((r: any) => ({
    id: r.id,
    category: r.category,
    name: r.name,
    unit: r.unit || "جرام",
    hasCustomName: r.has_custom_name,
    branches: r.branches,
    active: r.active,
    sortOrder: r.sort_order || 0
  }));
}

export async function fetchDayEntries(date: string, branch: string): Promise<DailyEntry[]> {
  const token = getSessionToken();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/daily_entries?select=*&date=eq.${date}&branch=eq.${encodeURIComponent(branch)}`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "x-session-token": token
    }
  });

  if (!res.ok) return [];
  const rows = await res.json();
  return (rows || []).map((r: any) => ({
    date: r.date,
    branch: r.branch,
    itemId: r.item_id,
    itemName: r.item_name,
    unit: r.unit,
    confirmed: r.confirmed,
    received: r.received != null ? Number(r.received) : 0,
    returned: r.returned != null ? Number(r.returned) : 0,
    remaining: r.remaining != null ? Number(r.remaining) : null,
    remainingWeight: r.remaining_weight != null ? Number(r.remaining_weight) : null,
    remainingSauce: r.remaining_sauce != null ? Number(r.remaining_sauce) : null,
    cookName: r.cook_name,
    notes: r.notes
  }));
}

export async function fetchCategorySales(date: string, branch: string): Promise<Record<string, number>> {
  const token = getSessionToken();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/tabsense_sales?select=category,qty&date=eq.${date}&branch=eq.${encodeURIComponent(branch)}`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "x-session-token": token
    }
  });

  if (!res.ok) return {};
  const rows = await res.json();
  const map: Record<string, number> = {};
  (rows || []).forEach((r: any) => {
    const c = String(r.category || "").trim();
    map[c] = (map[c] || 0) + Number(r.qty || 0);
  });
  return map;
}

export async function saveRemainingEntry(
  date: string,
  branch: string,
  itemId: string,
  itemName: string,
  unit: string,
  weight: number | null,
  isSauce: boolean,
  notes?: string
) {
  const token = getSessionToken();
  const row = {
    date,
    branch,
    item_id: itemId,
    item_name: itemName,
    unit,
    remaining: weight,
    remaining_weight: isSauce ? null : weight,
    remaining_sauce: isSauce ? weight : null,
    notes: notes || "",
    saved_at: new Date().toISOString()
  };

  const res = await fetch(`${SUPABASE_URL}/rest/v1/daily_entries?on_conflict=date,branch,item_id`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      "x-session-token": token,
      Prefer: "resolution=merge-duplicates"
    },
    body: JSON.stringify([row])
  });

  if (!res.ok) {
    throw new Error("فشل حفظ المتبقي في السحابة");
  }
}
