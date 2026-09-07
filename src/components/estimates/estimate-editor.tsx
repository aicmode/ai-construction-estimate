"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Save } from "lucide-react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";

import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Select, TextInput, Textarea, describedBy } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { EstimateItemRow } from "@/components/estimates/estimate-item-row";
import { ESTIMATE_STATUSES, ESTIMATE_STATUS_LABELS, toOptions } from "@/lib/domain";
import { tryCalcEstimate } from "@/lib/estimate/calc";
import { formatPercent, formatYen } from "@/lib/money";
import {
  type EstimateFormValues,
  type EstimateInput,
  type EstimateItemFormValues,
  estimateSchema,
} from "@/lib/validation/estimate";
import type { CustomerOption } from "@/server/queries/customers";
import type { ProjectOption } from "@/server/queries/projects";
import type { ActionResult } from "@/server/actions/result";

const STATUS_OPTIONS = toOptions(ESTIMATE_STATUSES, ESTIMATE_STATUS_LABELS);

export const EMPTY_ITEM: EstimateItemFormValues = {
  id: "",
  name: "",
  category: "other",
  description: "",
  quantity: 1,
  unit: "set",
  unitPrice: 0,
  unitCost: 0,
};

/** Guards against NaN reaching the calculator while a number field is empty. */
function toNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function EstimateEditor({
  defaultValues,
  customers,
  projects,
  submitLabel,
  onSubmitAction,
  cancelHref,
}: {
  defaultValues: EstimateFormValues;
  customers: CustomerOption[];
  projects: ProjectOption[];
  submitLabel: string;
  onSubmitAction: (input: EstimateInput) => Promise<ActionResult<{ id: string }>>;
  cancelHref: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [formError, setFormError] = React.useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<EstimateFormValues, unknown, EstimateInput>({
    resolver: zodResolver(estimateSchema),
    defaultValues,
  });

  const { fields, append, remove, swap } = useFieldArray({ control, name: "items" });

  const watchedItems = useWatch({ control, name: "items" });
  const watchedTaxRate = useWatch({ control, name: "taxRate" });
  const watchedDiscount = useWatch({ control, name: "discountAmount" });
  const watchedCustomerId = useWatch({ control, name: "customerId" });

  /**
   * Live totals mirror the server calculation exactly — both call
   * `calcEstimate`. These values are for display only; the server recomputes
   * them from the submitted quantities and unit rates before persisting.
   */
  const calculation = React.useMemo(() => {
    const items = (watchedItems ?? []).map((item) => ({
      quantity: toNumber(item?.quantity),
      unitPrice: toNumber(item?.unitPrice),
      unitCost: toNumber(item?.unitCost),
    }));
    return tryCalcEstimate({
      items,
      taxRate: toNumber(watchedTaxRate),
      discountAmount: toNumber(watchedDiscount),
    });
  }, [watchedItems, watchedTaxRate, watchedDiscount]);

  const totals = calculation.ok ? calculation.value : null;

  // Projects belong to a customer; showing another customer's project would let
  // the user build an inconsistent estimate (the server rejects it anyway).
  const selectableProjects = React.useMemo(
    () => projects.filter((project) => !watchedCustomerId || project.customerId === watchedCustomerId),
    [projects, watchedCustomerId],
  );

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await onSubmitAction(values);

    if (!result.ok) {
      setFormError(result.error);
      for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
        const key = field.split(".")[0];
        if (key in values) {
          setError(key as keyof EstimateFormValues, { message: messages[0] });
        }
      }
      toast.error(result.error);
      return;
    }

    toast.success(`見積を${submitLabel}しました。`);
    router.push(`/estimates/${result.data.id}`);
    router.refresh();
  });

  if (customers.length === 0) {
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-ink-soft">
            見積を作成するには、先に顧客を登録してください。
          </p>
          <LinkButton href="/customers/new" variant="primary" className="mt-4">
            顧客を登録
          </LinkButton>
        </CardBody>
      </Card>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      {formError ? (
        <p
          role="alert"
          className="mb-4 rounded-md border border-red-200 bg-danger-soft px-3 py-2 text-sm text-danger"
        >
          {formError}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader title="基本情報" />
            <CardBody className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <Field
                id="title"
                label="見積タイトル"
                required
                className="md:col-span-2"
                error={errors.title?.message}
              >
                <TextInput
                  id="title"
                  placeholder="戸建てキッチン改修工事一式"
                  invalid={Boolean(errors.title)}
                  aria-describedby={describedBy("title", false, errors.title)}
                  {...register("title")}
                />
              </Field>

              <Field id="customerId" label="顧客" required error={errors.customerId?.message}>
                <Select
                  id="customerId"
                  invalid={Boolean(errors.customerId)}
                  aria-describedby={describedBy("customerId", false, errors.customerId)}
                  {...register("customerId")}
                >
                  <option value="">選択してください</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.companyName
                        ? `${customer.name}（${customer.companyName}）`
                        : customer.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                id="projectId"
                label="工事案件"
                hint="顧客を選択すると、その顧客の案件のみ表示されます。"
                error={errors.projectId?.message}
              >
                <Select
                  id="projectId"
                  invalid={Boolean(errors.projectId)}
                  aria-describedby={describedBy("projectId", true, errors.projectId)}
                  {...register("projectId")}
                >
                  <option value="">紐付けない</option>
                  {selectableProjects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field id="issueDate" label="発行日" required error={errors.issueDate?.message}>
                <TextInput
                  id="issueDate"
                  type="date"
                  invalid={Boolean(errors.issueDate)}
                  aria-describedby={describedBy("issueDate", false, errors.issueDate)}
                  {...register("issueDate")}
                />
              </Field>

              <Field id="validUntil" label="有効期限" error={errors.validUntil?.message}>
                <TextInput
                  id="validUntil"
                  type="date"
                  invalid={Boolean(errors.validUntil)}
                  aria-describedby={describedBy("validUntil", false, errors.validUntil)}
                  {...register("validUntil")}
                />
              </Field>

              <Field id="status" label="ステータス" required error={errors.status?.message}>
                <Select
                  id="status"
                  invalid={Boolean(errors.status)}
                  aria-describedby={describedBy("status", false, errors.status)}
                  {...register("status")}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                id="taxRate"
                label="消費税率（%）"
                required
                hint="標準税率10%／軽減税率8%"
                error={errors.taxRate?.message}
              >
                <TextInput
                  id="taxRate"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  inputMode="decimal"
                  className="tabular"
                  invalid={Boolean(errors.taxRate)}
                  aria-describedby={describedBy("taxRate", true, errors.taxRate)}
                  {...register("taxRate", { valueAsNumber: true })}
                />
              </Field>

              <Field
                id="discountAmount"
                label="値引き額（税抜・円）"
                hint="明細合計から差し引きます。"
                error={errors.discountAmount?.message}
              >
                <TextInput
                  id="discountAmount"
                  type="number"
                  step="1"
                  min="0"
                  inputMode="numeric"
                  className="tabular"
                  invalid={Boolean(errors.discountAmount)}
                  aria-describedby={describedBy("discountAmount", true, errors.discountAmount)}
                  {...register("discountAmount", { valueAsNumber: true })}
                />
              </Field>

              <Field
                id="paymentTerms"
                label="支払条件"
                className="md:col-span-2"
                error={errors.paymentTerms?.message}
              >
                <TextInput
                  id="paymentTerms"
                  placeholder="着手時50%・完了引渡時50%"
                  invalid={Boolean(errors.paymentTerms)}
                  aria-describedby={describedBy("paymentTerms", false, errors.paymentTerms)}
                  {...register("paymentTerms")}
                />
              </Field>

              <Field id="notes" label="備考" className="md:col-span-2" error={errors.notes?.message}>
                <Textarea
                  id="notes"
                  rows={3}
                  placeholder="本見積は現地調査時点の内容に基づくものです。"
                  invalid={Boolean(errors.notes)}
                  aria-describedby={describedBy("notes", false, errors.notes)}
                  {...register("notes")}
                />
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="見積明細"
              description={`${fields.length} 行・数量 × 単価は自動計算されます`}
              actions={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => append({ ...EMPTY_ITEM })}
                >
                  <Plus aria-hidden className="size-4" />
                  明細を追加
                </Button>
              }
            />
            <CardBody className="p-0">
              {typeof errors.items?.message === "string" ? (
                <p role="alert" className="px-5 pt-4 text-sm font-medium text-danger">
                  {errors.items.message}
                </p>
              ) : null}

              {/* Column headings for wide screens; each control keeps its own
                  label for narrow screens and screen readers. */}
              <div className="hidden border-b border-steel-200 bg-steel-50 px-5 py-2 text-xs font-medium text-ink-muted lg:flex">
                <span className="w-6 shrink-0" />
                <span className="ml-3 flex-1">工事項目・カテゴリ・摘要／数量・単位・単価</span>
                <span className="w-[104px] shrink-0" />
              </div>

              <ul>
                {fields.map((field, index) => {
                  const itemTotals = totals?.items[index];
                  return (
                    <EstimateItemRow
                      key={field.id}
                      index={index}
                      register={register}
                      errors={errors}
                      amount={itemTotals?.amount ?? 0}
                      costAmount={itemTotals?.costAmount ?? 0}
                      canRemove={fields.length > 1}
                      isFirst={index === 0}
                      isLast={index === fields.length - 1}
                      onRemove={() => remove(index)}
                      onMoveUp={() => index > 0 && swap(index, index - 1)}
                      onMoveDown={() => index < fields.length - 1 && swap(index, index + 1)}
                    />
                  );
                })}
              </ul>

              <div className="border-t border-steel-200 p-4">
                <Button variant="secondary" onClick={() => append({ ...EMPTY_ITEM })} className="w-full sm:w-auto">
                  <Plus aria-hidden className="size-4" />
                  明細を追加
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>

        <aside className="xl:sticky xl:top-6 xl:h-fit">
          <Card>
            <CardHeader title="金額サマリー" description="入力に応じてリアルタイム計算" />
            <CardBody>
              {!calculation.ok ? (
                <p role="alert" className="rounded-md border border-amber-200 bg-warning-soft px-3 py-2 text-sm text-warning">
                  {calculation.message}
                </p>
              ) : (
                <dl className="flex flex-col gap-2.5 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-ink-muted">明細合計</dt>
                    <dd className="tabular font-medium text-ink">{formatYen(totals!.itemsSubtotal)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-ink-muted">値引き</dt>
                    <dd className="tabular font-medium text-ink">
                      {totals!.discountAmount > 0 ? `-${formatYen(totals!.discountAmount)}` : formatYen(0)}
                    </dd>
                  </div>
                  <div className="flex justify-between border-t border-steel-200 pt-2.5">
                    <dt className="text-ink-muted">税抜合計</dt>
                    <dd className="tabular font-medium text-ink">{formatYen(totals!.subtotalAmount)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-ink-muted">消費税</dt>
                    <dd className="tabular font-medium text-ink">{formatYen(totals!.taxAmount)}</dd>
                  </div>
                  <div className="flex items-baseline justify-between border-t-2 border-steel-800 pt-3">
                    <dt className="font-semibold text-ink">合計（税込）</dt>
                    <dd className="tabular text-xl font-bold text-ink">{formatYen(totals!.totalAmount)}</dd>
                  </div>

                  <div className="mt-2 rounded-md bg-steel-50 p-3">
                    <div className="flex justify-between text-sm">
                      <dt className="text-ink-muted">原価合計</dt>
                      <dd className="tabular font-medium text-ink">{formatYen(totals!.costAmount)}</dd>
                    </div>
                    <div className="mt-1.5 flex justify-between text-sm">
                      <dt className="text-ink-muted">粗利益</dt>
                      <dd
                        className={
                          totals!.grossProfit < 0
                            ? "tabular font-semibold text-danger"
                            : "tabular font-semibold text-ink"
                        }
                      >
                        {formatYen(totals!.grossProfit)}
                      </dd>
                    </div>
                    <div className="mt-1.5 flex justify-between text-sm">
                      <dt className="text-ink-muted">粗利率</dt>
                      <dd
                        className={
                          totals!.grossMarginRate < 0.1
                            ? "tabular font-semibold text-danger"
                            : "tabular font-semibold text-success"
                        }
                      >
                        {formatPercent(totals!.grossMarginRate)}
                      </dd>
                    </div>
                  </div>
                </dl>
              )}

              <div className="mt-5 flex flex-col gap-2">
                <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
                  <Save aria-hidden className="size-4" />
                  {isSubmitting ? "保存しています…" : `見積を${submitLabel}`}
                </Button>
                <LinkButton href={cancelHref} variant="secondary" className="w-full">
                  キャンセル
                </LinkButton>
              </div>
            </CardBody>
          </Card>
        </aside>
      </div>
    </form>
  );
}
