"use client";

import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import {
  Employee,
  Item,
  DailyEntry
} from "@/lib/types";
import {
  getCurrentUser,
  canSeeSales,
  loginWithPin,
  fetchItems,
  fetchDayEntries,
  fetchCategorySales,
  saveRemainingEntry,
} from "@/lib/supabase";
import {
  Lock,
  LogOut,
  Calendar,
  Store,
  Layers,
  Package,
  TrendingUp,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Search
} from "lucide-react";

const BRANCHES = ["الروضة", "الشاطئ", "عبداللطيف جميل"];
const MEAL_WEIGHT_G = 150;

export default function OperationsApp() {
  const [currentUser, setCurrentUser] = useState<Employee | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [pin, setPin] = useState("");
  const [loginError, setLoginError] = useState("");

  const [activeTab, setActiveTab] = useState<"remaining" | "receiving" | "analytics">("remaining");
  const [selectedBranch, setSelectedBranch] = useState(BRANCHES[0]);
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split("T")[0];
  });

  const [items, setItems] = useState<Item[]>([]);
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [categorySales, setCategorySales] = useState<Record<string, number>>({});
  const [loadingData, setLoadingData] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const [savingStatus, setSavingStatus] = useState<string | null>(null);

  // Load user on startup
  useEffect(() => {
    const u = getCurrentUser();
    if (u) {
      setCurrentUser(u);
      if (u.branches && u.branches.length > 0) {
        setSelectedBranch(u.branches[0]);
      }
    }
  }, []);

  // Fetch data when date, branch, or user changes
  useEffect(() => {
    if (!currentUser) return;
    let isCancelled = false;

    async function loadAll() {
      setLoadingData(true);
      try {
        const [itemsRes, entriesRes, salesRes] = await Promise.all([
          fetchItems(),
          fetchDayEntries(selectedDate, selectedBranch),
          canSeeSales(currentUser) ? fetchCategorySales(selectedDate, selectedBranch) : Promise.resolve({})
        ]);
        if (!isCancelled) {
          setItems(itemsRes);
          setEntries(entriesRes);
          setCategorySales(salesRes);
        }
      } catch (err) {
        console.error("Load error:", err);
      } finally {
        if (!isCancelled) setLoadingData(false);
      }
    }

    loadAll();
    return () => { isCancelled = true; };
  }, [currentUser, selectedDate, selectedBranch]);

  // Handle PIN input
  const handleKeypadPress = async (digit: string) => {
    if (digit === "CLEAR") {
      setPin("");
      setLoginError("");
      return;
    }
    if (digit === "BACK") {
      setPin((prev) => prev.slice(0, -1));
      return;
    }
    const newPin = pin + digit;
    setPin(newPin);
    if (newPin.length >= 4) {
      setIsLoggingIn(true);
      setLoginError("");
      try {
        const res = await loginWithPin(newPin);
        setCurrentUser(res.employee);
        if (res.employee.branches && res.employee.branches.length > 0) {
          setSelectedBranch(res.employee.branches[0]);
        }
        setPin("");
      } catch (err: any) {
        setLoginError(err.message || "الرقم السري غير صحيح");
        setPin("");
      } finally {
        setIsLoggingIn(false);
      }
    }
  };

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("ph_token");
      localStorage.removeItem("ph_employee_v2");
    }
    setCurrentUser(null);
    setPin("");
  };

  // Group items by category (excluding Carbs)
  const categoriesGrouped = useMemo(() => {
    const map: Record<string, Item[]> = {};
    const entryMap = new Map<string, DailyEntry>();
    entries.forEach((e) => entryMap.set(e.itemId, e));

    items.forEach((item) => {
      const cat = item.category || "عام";
      // استبعاد تصنيف الكارب نهائياً
      if (cat.toLowerCase().includes("كارب") || cat.toLowerCase().includes("carb")) {
        return;
      }
      if (searchFilter && !item.name.toLowerCase().includes(searchFilter.toLowerCase())) {
        return;
      }
      if (!map[cat]) map[cat] = [];
      map[cat].push(item);
    });
    return map;
  }, [items, entries, searchFilter]);

  // Update item remaining weight or sauce toggle
  const handleWeightChange = async (item: Item, val: string) => {
    const num = val === "" ? null : Number(val);
    const existing = entries.find((e) => e.itemId === item.id);
    const isSauce = existing?.remainingSauce != null && existing.remainingSauce > 0;

    // Local optimistic update
    setEntries((prev) => {
      const idx = prev.findIndex((e) => e.itemId === item.id);
      const updated: DailyEntry = {
        date: selectedDate,
        branch: selectedBranch,
        itemId: item.id,
        itemName: item.name,
        unit: item.unit,
        confirmed: existing?.confirmed,
        received: existing?.received,
        returned: existing?.returned,
        remaining: num,
        remainingWeight: isSauce ? null : num,
        remainingSauce: isSauce ? num : null,
      };
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = updated;
        return copy;
      }
      return [...prev, updated];
    });

    // Save to Supabase
    try {
      setSavingStatus("جاري الحفظ…");
      await saveRemainingEntry(
        selectedDate,
        selectedBranch,
        item.id,
        item.name,
        item.unit,
        num,
        isSauce
      );
      setSavingStatus("✅ تم الحفظ السحابي");
      setTimeout(() => setSavingStatus(null), 1500);
    } catch {
      setSavingStatus("⚠️ خطأ في الحفظ");
    }
  };

  const handleToggleSauce = async (item: Item) => {
    const existing = entries.find((e) => e.itemId === item.id);
    const currentVal = existing?.remaining ?? existing?.remainingWeight ?? existing?.remainingSauce ?? null;
    const isCurrentlySauce = existing?.remainingSauce != null && existing.remainingSauce > 0;
    const newIsSauce = !isCurrentlySauce;

    // Optimistic update
    setEntries((prev) => {
      const idx = prev.findIndex((e) => e.itemId === item.id);
      const updated: DailyEntry = {
        date: selectedDate,
        branch: selectedBranch,
        itemId: item.id,
        itemName: item.name,
        unit: item.unit,
        confirmed: existing?.confirmed,
        received: existing?.received,
        returned: existing?.returned,
        remaining: currentVal,
        remainingWeight: newIsSauce ? null : currentVal,
        remainingSauce: newIsSauce ? currentVal : null,
      };
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = updated;
        return copy;
      }
      return [...prev, updated];
    });

    try {
      setSavingStatus("جاري الحفظ…");
      await saveRemainingEntry(
        selectedDate,
        selectedBranch,
        item.id,
        item.name,
        item.unit,
        currentVal,
        newIsSauce
      );
      setSavingStatus("✅ تم الحفظ السحابي");
      setTimeout(() => setSavingStatus(null), 1500);
    } catch {
      setSavingStatus("⚠️ خطأ في الحفظ");
    }
  };

  // -------------------------------------------------------------
  // RENDER: LOGIN KIOSK VIEW
  // -------------------------------------------------------------
  if (!currentUser) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm flex flex-col items-center">
          <div className="relative w-24 h-24 mb-3 rounded-2xl bg-amber-400/10 p-2 border border-amber-400/30 flex items-center justify-center">
            <Image
              src="/assets/logo.png"
              alt="Pro House"
              width={80}
              height={80}
              className="object-contain"
              priority
            />
          </div>

          <h1 className="text-2xl font-black text-amber-400 tracking-wide">
            PRO HOUSE
          </h1>
          <p className="text-xs text-slate-400 mb-6 font-medium">
            مركز العمليات والإمداد السحابي v2.0
          </p>

          <div className="w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col items-center">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-4">
              <Lock className="w-4 h-4 text-amber-400" />
              <span>أدخل الرقم السري للموظف</span>
            </div>

            {/* PIN Dots */}
            <div className="flex gap-3 mb-6">
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                    pin.length > idx
                      ? "bg-amber-400 border-amber-400 scale-110 shadow-[0_0_12px_rgba(247,220,78,0.5)]"
                      : "border-slate-700 bg-slate-800"
                  }`}
                />
              ))}
            </div>

            {loginError && (
              <div className="w-full mb-4 py-2 px-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-xl text-center">
                {loginError}
              </div>
            )}

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "CLEAR", "0", "BACK"].map(
                (btn) => (
                  <button
                    key={btn}
                    type="button"
                    disabled={isLoggingIn}
                    onClick={() => handleKeypadPress(btn)}
                    className={`h-14 rounded-2xl font-bold text-lg flex items-center justify-center transition-all active:scale-95 ${
                      btn === "CLEAR"
                        ? "text-xs text-rose-400 bg-slate-800/60 active:bg-rose-950/40"
                        : btn === "BACK"
                        ? "text-slate-400 bg-slate-800/60 active:bg-slate-700"
                        : "bg-slate-800 hover:bg-slate-750 text-white border border-slate-700/50 active:bg-amber-400 active:text-slate-950 shadow-sm"
                    }`}
                  >
                    {btn === "CLEAR" ? "مسح" : btn === "BACK" ? "⌫" : btn}
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      </main>
    );
  }

  // -------------------------------------------------------------
  // RENDER: MAIN APPLICATION VIEW
  // -------------------------------------------------------------
  const isOwner = canSeeSales(currentUser);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col pb-20">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-slate-900 text-white shadow-md border-b border-slate-800 px-4 py-2.5">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center overflow-hidden p-1">
              <Image
                src="/assets/logo.png"
                alt="Pro House"
                width={32}
                height={32}
                className="object-contain"
              />
            </div>
            <div>
              <div className="font-extrabold text-sm text-amber-400 flex items-center gap-1.5 leading-tight">
                برو هاوس اوبريشن
                <span className="text-[10px] bg-amber-400/20 text-amber-300 font-bold px-1.5 py-0.5 rounded border border-amber-400/40">
                  V2
                </span>
              </div>
              <div className="text-[11px] text-slate-400 font-medium">
                {currentUser.name} ({isOwner ? "إدارة" : "طاقم الفرع"})
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {savingStatus && (
              <span className="text-xs bg-slate-800 text-amber-300 px-2.5 py-1 rounded-full border border-slate-700 animate-pulse hidden sm:inline-block">
                {savingStatus}
              </span>
            )}
            <button
              onClick={handleLogout}
              className="p-2 rounded-xl bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-300 border border-slate-700/60 transition-all"
              title="تسجيل خروج"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Control Bar: Branch & Date */}
      <div className="bg-white border-b border-slate-200 px-4 py-2 shadow-xs">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Store className="w-4 h-4 text-slate-500 shrink-0" />
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="bg-slate-50 border border-slate-300 text-slate-800 text-xs font-bold rounded-lg px-2.5 py-1.5 outline-none focus:border-amber-400"
            >
              {BRANCHES.map((b) => (
                <option key={b} value={b}>
                  فرع {b}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-slate-50 border border-slate-300 text-slate-800 text-xs font-bold rounded-lg px-2.5 py-1.5 outline-none focus:border-amber-400"
            />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="max-w-4xl mx-auto w-full px-3 py-3 flex-1 flex flex-col gap-3">
        {/* Search & Quick Filter */}
        <div className="relative">
          <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="بحث عن صنف (دجاج، ساندويتش، صوص...)"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl pr-9 pl-4 py-2 text-xs font-medium focus:border-amber-400 focus:outline-none shadow-2xs"
          />
        </div>

        {loadingData ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-3">
            <div className="w-8 h-8 border-3 border-amber-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-bold">جاري تحميل الأصناف والجرد اللحظي…</span>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {Object.entries(categoriesGrouped).map(([category, catItems]) => {
              // Calculate category metrics
              let totalReceived = 0;
              let totalChickenRemaining = 0;
              let totalSauceRemaining = 0;
              const isSandwich = category.includes("ساندويتش") || category.includes("فطور");
              const isSalad = category.includes("سلط");
              const isWeightMeal = category.includes("دجاج") || category.includes("لحم") || category.includes("بحري");

              catItems.forEach((it) => {
                const e = entries.find((x) => x.itemId === it.id);
                totalReceived += e?.received || 0;
                const isSauce = e?.remainingSauce != null && e.remainingSauce > 0;
                const remVal = e?.remaining ?? e?.remainingWeight ?? e?.remainingSauce ?? 0;
                if (isSauce) {
                  totalSauceRemaining += remVal;
                } else {
                  totalChickenRemaining += remVal;
                }
              });

              const soldMeals = categorySales[category] || 0;
              const chickenMeals = isWeightMeal ? Math.round(totalChickenRemaining / MEAL_WEIGHT_G) : totalChickenRemaining;
              const expectedRemaining = isWeightMeal
                ? Math.max(0, Math.round(totalReceived / MEAL_WEIGHT_G) - soldMeals)
                : Math.max(0, Math.round(totalReceived) - soldMeals);

              const variance = chickenMeals - expectedRemaining;

              return (
                <div
                  key={category}
                  className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden"
                >
                  {/* Category Header Bar with Live Metrics */}
                  <div className="bg-slate-900 text-white px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                      <h2 className="font-extrabold text-sm tracking-wide text-white">
                        {category}
                      </h2>
                      <span className="text-[10px] text-slate-400 font-bold bg-slate-800 px-2 py-0.5 rounded-full">
                        {catItems.length} صنف
                      </span>
                    </div>

                    {/* Category Metrics Pills */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
                      {/* 1. المستلم */}
                      <span className="bg-slate-800/90 text-slate-300 px-2 py-0.5 rounded-md border border-slate-700/60">
                        📥 {isWeightMeal ? `${Math.round(totalReceived)} جم` : `${Math.round(totalReceived)} حبة`}
                      </span>

                      {/* 2. المباع (للإدارة فقط) */}
                      {isOwner && (
                        <span className="bg-blue-950/70 text-blue-300 px-2 py-0.5 rounded-md border border-blue-800/60">
                          💳 {soldMeals} مباع
                        </span>
                      )}

                      {/* 3. المتبقي */}
                      <span className="bg-amber-950/70 text-amber-300 px-2 py-0.5 rounded-md border border-amber-800/60">
                        {isWeightMeal ? `🍗 ${chickenMeals} وجبة (${Math.round(totalChickenRemaining)} جم)` : `📦 ${chickenMeals} متبقي`}
                        {totalSauceRemaining > 0 && ` + 🥣 ${Math.round(totalSauceRemaining)} جم`}
                      </span>

                      {/* 4. الانحراف / العجز (للإدارة فقط) */}
                      {isOwner && (
                        <span
                          className={`px-2 py-0.5 rounded-md border font-extrabold ${
                            variance === 0
                              ? "bg-emerald-950/80 text-emerald-400 border-emerald-800/60"
                              : variance < 0
                              ? "bg-rose-950/80 text-rose-300 border-rose-800/60"
                              : "bg-amber-950/80 text-amber-300 border-amber-800/60"
                          }`}
                        >
                          {variance === 0
                            ? "✅ مطابق"
                            : variance < 0
                            ? `🔻 عجز: ${Math.abs(variance)}`
                            : `🔺 زيادة: +${variance}`}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Item Cards inside Category */}
                  <div className="divide-y divide-slate-100">
                    {catItems.map((item) => {
                      const entry = entries.find((e) => e.itemId === item.id);
                      const isSauce = entry?.remainingSauce != null && entry.remainingSauce > 0;
                      const rawVal = entry?.remaining ?? entry?.remainingWeight ?? entry?.remainingSauce ?? "";
                      const numVal = rawVal === "" ? 0 : Number(rawVal);
                      const recQty = entry?.received || 0;

                      return (
                        <div
                          key={item.id}
                          className="px-3.5 py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
                        >
                          {/* Item Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-xs text-slate-800 truncate">
                                {item.name}
                              </span>
                              <span className="text-[10px] text-slate-400 font-medium">
                                ({item.unit || "جم"})
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold">
                                📦 مستلم: {recQty > 0 ? recQty : "—"}
                              </span>
                              {numVal > 0 && isWeightMeal && !isSauce && (
                                <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-bold">
                                  🍽️ {Math.round(numVal / MEAL_WEIGHT_G)} وجبة
                                </span>
                              )}
                              {numVal > 0 && isSauce && (
                                <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold">
                                  🥣 {numVal} جم صوص
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Inputs: Weight + Sauce Toggle + Quick Zero */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <div className="relative flex items-center">
                              <input
                                type="number"
                                inputMode="decimal"
                                placeholder="0"
                                value={rawVal}
                                onChange={(e) => handleWeightChange(item, e.target.value)}
                                className={`w-20 text-center font-black text-sm h-9 rounded-xl border transition-all outline-none ${
                                  numVal > 0
                                    ? "border-emerald-500 bg-emerald-50/30 text-emerald-950 font-black shadow-xs"
                                    : "border-slate-300 bg-white text-slate-800 focus:border-amber-400"
                                }`}
                              />
                              <span className="absolute left-1.5 text-[9px] text-slate-400 font-bold pointer-events-none">
                                {item.unit || "جم"}
                              </span>
                            </div>

                            {/* Quick Zero Button */}
                            <button
                              type="button"
                              onClick={() => handleWeightChange(item, "0")}
                              className="h-9 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-all active:scale-95"
                              title="نفد (0)"
                            >
                              0
                            </button>

                            {/* Sauce Toggle Button (Only for Weight Meals) */}
                            {isWeightMeal && (
                              <button
                                type="button"
                                onClick={() => handleToggleSauce(item)}
                                className={`h-9 px-2.5 rounded-xl text-[11px] font-extrabold border transition-all flex items-center gap-1 active:scale-95 ${
                                  isSauce
                                    ? "bg-amber-100 border-amber-500 text-amber-900 shadow-xs"
                                    : "bg-white border-slate-300 text-slate-600 hover:bg-slate-50"
                                }`}
                                title={isSauce ? "محسوب كصوص (اضغط للعودة لدجاج/لحم)" : "اضغط لو كان متبقي الوزن صوص"}
                              >
                                {isSauce ? "✅ 🥣 صوص" : "🥣 صوص"}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Bottom Sticky Tab Navigation */}
      <nav className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-200 py-2 px-6 flex justify-around items-center z-40 shadow-lg">
        <button
          onClick={() => setActiveTab("remaining")}
          className={`flex flex-col items-center gap-1 transition-all ${
            activeTab === "remaining" ? "text-amber-500 font-black scale-105" : "text-slate-400 font-bold"
          }`}
        >
          <Layers className="w-5 h-5" />
          <span className="text-[10px]">جرد المتبقي</span>
        </button>

        <button
          onClick={() => setActiveTab("receiving")}
          className={`flex flex-col items-center gap-1 transition-all ${
            activeTab === "receiving" ? "text-amber-500 font-black scale-105" : "text-slate-400 font-bold"
          }`}
        >
          <Package className="w-5 h-5" />
          <span className="text-[10px]">الاستلام الصباحي</span>
        </button>

        {isOwner && (
          <button
            onClick={() => setActiveTab("analytics")}
            className={`flex flex-col items-center gap-1 transition-all ${
              activeTab === "analytics" ? "text-amber-500 font-black scale-105" : "text-slate-400 font-bold"
            }`}
          >
            <TrendingUp className="w-5 h-5" />
            <span className="text-[10px]">مبيعات تابسنس</span>
          </button>
        )}
      </nav>
    </div>
  );
}
