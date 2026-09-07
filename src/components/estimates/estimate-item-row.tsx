"use client";

import * as React from "react";

import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import type { FieldErrors, UseFormRegister } from "react-hook-form";

import { Select, TextInput } from "@/components/ui/field";
import {
  ITEM_CATEGORIES,
  ITEM_CATEGORY_LABELS,
  UNIT_LABELS,
  UNIT_TYPES,
  toOptions,
} from "@/lib/domain";
import { formatYen } from "@/lib/money";
import type { EstimateFormValues } from "@/lib/validation/estimate";

const CATEGORY_OPTIONS = toOptions(ITEM_CATEGORIES, ITEM_CATEGORY_LABELS);
const UNIT_OPTIONS = toOptions(UNIT_TYPES, UNIT_LABELS);

/** Small label shown above each control — visible on mobile, hidden on wide screens. */
function CellLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-xs font-medium text-ink-muted lg:sr-only">
      {children}
    </label>
  );
}

export interface EstimateItemRowProps {
  index: number;
  register: UseFormRegister<EstimateFormValues>;
  errors: FieldErrors<EstimateFormValues>;
  amount: number;
  costAmount: number;
  canRemove: boolean;
  isFirst: boolean;
  isLast: boolean;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export function EstimateItemRow({
  index,
  register,
  errors,
  amount,
  costAmount,
  canRemove,
  isFirst,
  isLast,
  onRemove,
  onMoveUp,
  onMoveDown,
}: EstimateItemRowProps) {
  const itemErrors = errors.items?.[index];
  const profit = amount - costAmount;

  // `useId` produces the same value on the server and on the client. The row
  // keys from `useFieldArray` are regenerated per render pass, so deriving DOM
  // ids from them made every `id`/`htmlFor` pair mismatch during hydration.
  const rowId = React.useId();
  const id = (field: string) => `item-${rowId}-${field}`;

  return (
    <li className="border-b border-steel-200 p-4 last:border-b-0 even:bg-steel-50/60 lg:px-5">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-2 hidden w-6 shrink-0 text-right text-sm font-medium text-ink-muted lg:block"
        >
          {index + 1}
        </span>

        <div className="min-w-0 flex-1">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <CellLabel htmlFor={id("name")}>
                <span className="lg:hidden">工事項目名 {index + 1}</span>
                <span className="hidden lg:inline">工事項目名</span>
              </CellLabel>
              <TextInput
                id={id("name")}
                placeholder="システムキッチン交換工事"
                invalid={Boolean(itemErrors?.name)}
                {...register(`items.${index}.name` as const)}
              />
              {itemErrors?.name ? (
                <p className="mt-1 text-xs font-medium text-danger">{itemErrors.name.message}</p>
              ) : null}
            </div>

            <div className="lg:col-span-5">
              <CellLabel htmlFor={id("category")}>カテゴリ</CellLabel>
              <Select
                id={id("category")}
                invalid={Boolean(itemErrors?.category)}
                {...register(`items.${index}.category` as const)}
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="lg:col-span-12">
              <CellLabel htmlFor={id("description")}>内容・摘要</CellLabel>
              <TextInput
                id={id("description")}
                placeholder="既存撤去・処分費を含む"
                invalid={Boolean(itemErrors?.description)}
                {...register(`items.${index}.description` as const)}
              />
              {itemErrors?.description ? (
                <p className="mt-1 text-xs font-medium text-danger">
                  {itemErrors.description.message}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:col-span-8 lg:grid-cols-4">
              <div>
                <CellLabel htmlFor={id("quantity")}>数量</CellLabel>
                <TextInput
                  id={id("quantity")}
                  type="number"
                  step="0.001"
                  min="0"
                  inputMode="decimal"
                  className="tabular text-right"
                  invalid={Boolean(itemErrors?.quantity)}
                  {...register(`items.${index}.quantity` as const, { valueAsNumber: true })}
                />
              </div>

              <div>
                <CellLabel htmlFor={id("unit")}>単位</CellLabel>
                <Select
                  id={id("unit")}
                  invalid={Boolean(itemErrors?.unit)}
                  {...register(`items.${index}.unit` as const)}
                >
                  {UNIT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <CellLabel htmlFor={id("unitPrice")}>販売単価（円）</CellLabel>
                <TextInput
                  id={id("unitPrice")}
                  type="number"
                  step="1"
                  min="0"
                  inputMode="numeric"
                  className="tabular text-right"
                  invalid={Boolean(itemErrors?.unitPrice)}
                  {...register(`items.${index}.unitPrice` as const, { valueAsNumber: true })}
                />
              </div>

              <div>
                <CellLabel htmlFor={id("unitCost")}>原価単価（円）</CellLabel>
                <TextInput
                  id={id("unitCost")}
                  type="number"
                  step="1"
                  min="0"
                  inputMode="numeric"
                  className="tabular text-right"
                  invalid={Boolean(itemErrors?.unitCost)}
                  {...register(`items.${index}.unitCost` as const, { valueAsNumber: true })}
                />
              </div>
            </div>

            {/*
              Derived values: displayed, never submitted — the server recomputes
              them. Narrow screens lay them out as inline label/value pairs that
              can wrap; wide screens use a right-aligned three column grid.
            */}
            <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 rounded-md bg-white px-3 py-2 lg:col-span-4 lg:grid lg:grid-cols-3 lg:gap-3 lg:bg-transparent lg:px-0 lg:py-0">
              <div className="flex items-baseline gap-1.5 lg:block lg:text-right">
                <p className="text-xs text-ink-muted">金額</p>
                <p className="tabular text-sm font-semibold text-ink">{formatYen(amount)}</p>
              </div>
              <div className="flex items-baseline gap-1.5 lg:block lg:text-right">
                <p className="text-xs text-ink-muted">原価</p>
                <p className="tabular text-sm text-ink-soft">{formatYen(costAmount)}</p>
              </div>
              <div className="flex items-baseline gap-1.5 lg:block lg:text-right">
                <p className="text-xs text-ink-muted">粗利</p>
                <p
                  className={
                    profit < 0
                      ? "tabular text-sm font-semibold text-danger"
                      : "tabular text-sm text-ink-soft"
                  }
                >
                  {formatYen(profit)}
                </p>
              </div>
            </div>
          </div>

          {(itemErrors?.quantity || itemErrors?.unitPrice || itemErrors?.unitCost) ? (
            <p className="mt-2 text-xs font-medium text-danger">
              {itemErrors?.quantity?.message ??
                itemErrors?.unitPrice?.message ??
                itemErrors?.unitCost?.message}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={isFirst}
            aria-label={`${index + 1}行目を上へ移動`}
            className="flex size-9 items-center justify-center rounded-md border border-steel-300 bg-white text-steel-600 hover:bg-steel-50 disabled:opacity-40"
          >
            <ArrowUp aria-hidden className="size-4" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={isLast}
            aria-label={`${index + 1}行目を下へ移動`}
            className="flex size-9 items-center justify-center rounded-md border border-steel-300 bg-white text-steel-600 hover:bg-steel-50 disabled:opacity-40"
          >
            <ArrowDown aria-hidden className="size-4" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={!canRemove}
            aria-label={`${index + 1}行目を削除`}
            className="flex size-9 items-center justify-center rounded-md border border-steel-300 bg-white text-danger hover:bg-danger-soft disabled:opacity-40"
          >
            <Trash2 aria-hidden className="size-4" />
          </button>
        </div>
      </div>
    </li>
  );
}
