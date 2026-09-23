export interface Employee {
  id: string;
  name: string;
  role: "owner" | "chef" | "employee" | "branch_staff";
  branches: string[];
}

export interface Item {
  id: string;
  category: string;
  name: string;
  unit: string;
  hasCustomName?: boolean;
  branches?: string;
  active: boolean;
  sortOrder: number;
}

export interface DailyEntry {
  date: string;
  branch: string;
  itemId: string;
  itemName: string;
  unit: string;
  confirmed?: boolean;
  received?: number;
  returned?: number;
  remaining?: number | null;
  remainingWeight?: number | null;
  remainingSauce?: number | null;
  cookName?: string;
  notes?: string;
}

export interface CategoryVarianceSummary {
  category: string;
  receivedTotal: number;
  soldMeals: number;
  remainingTotal: number;
  sauceTotal: number;
  varianceMeals: number;
  unit: string;
}
