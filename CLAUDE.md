# Pro House Operations Center V2 — Developer & Claude Guidelines

## Project Overview
- **Project**: Pro House Restaurant Chain Operations & Supply Chain OS.
- **Tech Stack**: Next.js 16 (App Router), TypeScript, Tailwind CSS, Supabase (PostgreSQL), Vercel.
- **Branches**: الروضة, الشاطئ, عبداللطيف جميل.
- **Owners**: أ. يزيد (emp_1), حسن (emp_2).
- **Staff**: الشيف عصام (emp_3), أبو يونس (emp_4), العامودي (emp_5), محمد البلول (emp_6), غالب (emp_7).

## Critical Business Logic & Inviolable Rules
1. **Protein Meals (دجاج, لحم, بحري)**:
   - 1 meal = strictly 150 grams (`MEAL_WEIGHT_G = 150`).
   - Formula: `Meals = Weight in grams / 150`.
   - Sauce Handling: Sauce is recorded in GRAMS. When `isSauce` is toggled (`[🥣 صوص]`), it is tracked as sauce weight and NOT counted as chicken meals, preventing false meat deficits.
   - Variance Formula: `Variance = Remaining Chicken Meals - (Received Meals - TabSense Sold Meals)`.

2. **Breakfast & Sandwiches (فطور, ساندويتشات)**:
   - Counted strictly 1:1 as pieces (`ساندويتش` / `حبة`), NEVER divided by grams.
   - NO sauce option.

3. **Salads (السلطات)**:
   - Counted strictly 1:1 as pieces (`حبة`).
   - NO sauce option.

4. **Carbs (كارب)**:
   - Completely excluded from daily remaining inventory views and calculations.

5. **Financial Security & Role-Based Access Control (RBAC)**:
   - **Owners Only (حسن & أ. يزيد)**: Can see TabSense sales numbers, variance/deficit pills, revenue/financial indicators.
   - **Branch Staff & Chef (محمد البلول, غالب, etc.)**: Must NEVER see sales, revenue, or variance. Their screen is restricted strictly to operational data entry (Received & Remaining).

## Architecture & Code Standards
- **App Router**: Use `src/app/` with clean server and client components (`"use client"` where state/interactivity is required).
- **Design System**:
  - RTL-first Arabic layout (`dir="rtl"`).
  - Luxury Obsidian Dark theme (`#08090C`, `#0F1217`, `#161A22`) with Pro House Brand Gold (`#F7DC4E`).
  - Icons: `lucide-react`.
  - Animation: `framer-motion`.
  - Tabular numbers: `tabular-nums font-mono` for all weights and quantities.
- **Database (Supabase)**:
  - Client in `src/lib/supabase.ts`.
  - Primary tables: `items`, `daily_entries`, `day_meta`, `tabsense_sales`, `employees`, `tomorrow_orders`, `juices`.
