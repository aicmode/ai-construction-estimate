"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Select, TextInput, Textarea, describedBy } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import {
  PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
  WORK_TYPES,
  WORK_TYPE_LABELS,
  toOptions,
} from "@/lib/domain";
import {
  type ProjectFormValues,
  type ProjectInput,
  projectSchema,
} from "@/lib/validation/project";
import type { CustomerOption } from "@/server/queries/customers";
import type { ActionResult } from "@/server/actions/result";

const WORK_TYPE_OPTIONS = toOptions(WORK_TYPES, WORK_TYPE_LABELS);
const STATUS_OPTIONS = toOptions(PROJECT_STATUSES, PROJECT_STATUS_LABELS);

export function ProjectForm({
  defaultValues,
  customers,
  submitLabel,
  onSubmitAction,
  cancelHref,
}: {
  defaultValues: ProjectFormValues;
  customers: CustomerOption[];
  submitLabel: string;
  onSubmitAction: (input: ProjectInput) => Promise<ActionResult<{ id: string }>>;
  cancelHref: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [formError, setFormError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProjectFormValues, unknown, ProjectInput>({
    resolver: zodResolver(projectSchema),
    defaultValues,
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await onSubmitAction(values);

    if (!result.ok) {
      setFormError(result.error);
      for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
        if (field in values) {
          setError(field as keyof ProjectFormValues, { message: messages[0] });
        }
      }
      toast.error(result.error);
      return;
    }

    toast.success(`${submitLabel}しました。`);
    router.push(`/projects/${result.data.id}`);
    router.refresh();
  });

  if (customers.length === 0) {
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-ink-soft">
            工事案件を登録するには、先に顧客を登録してください。
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
      <Card>
        <CardHeader title="工事案件情報" />
        <CardBody className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {formError ? (
            <p
              role="alert"
              className="rounded-md border border-red-200 bg-danger-soft px-3 py-2 text-sm text-danger md:col-span-2"
            >
              {formError}
            </p>
          ) : null}

          <Field id="name" label="案件名" required className="md:col-span-2" error={errors.name?.message}>
            <TextInput
              id="name"
              placeholder="渋谷区 戸建てキッチン改修"
              invalid={Boolean(errors.name)}
              aria-describedby={describedBy("name", false, errors.name)}
              {...register("name")}
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
                  {customer.companyName ? `${customer.name}（${customer.companyName}）` : customer.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field id="workType" label="工事種別" required error={errors.workType?.message}>
            <Select
              id="workType"
              invalid={Boolean(errors.workType)}
              aria-describedby={describedBy("workType", false, errors.workType)}
              {...register("workType")}
            >
              {WORK_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field id="siteAddress" label="施工場所" className="md:col-span-2" error={errors.siteAddress?.message}>
            <TextInput
              id="siteAddress"
              placeholder="東京都渋谷区神南0-0-0"
              invalid={Boolean(errors.siteAddress)}
              aria-describedby={describedBy("siteAddress", false, errors.siteAddress)}
              {...register("siteAddress")}
            />
          </Field>

          <Field id="description" label="工事概要" className="md:col-span-2" error={errors.description?.message}>
            <Textarea
              id="description"
              rows={4}
              placeholder="既存キッチンの解体・撤去、システムキッチン交換、内装補修一式"
              invalid={Boolean(errors.description)}
              aria-describedby={describedBy("description", false, errors.description)}
              {...register("description")}
            />
          </Field>

          <Field
            id="scheduledStartDate"
            label="着工予定日"
            error={errors.scheduledStartDate?.message}
          >
            <TextInput
              id="scheduledStartDate"
              type="date"
              invalid={Boolean(errors.scheduledStartDate)}
              aria-describedby={describedBy("scheduledStartDate", false, errors.scheduledStartDate)}
              {...register("scheduledStartDate")}
            />
          </Field>

          <Field id="scheduledEndDate" label="完了予定日" error={errors.scheduledEndDate?.message}>
            <TextInput
              id="scheduledEndDate"
              type="date"
              invalid={Boolean(errors.scheduledEndDate)}
              aria-describedby={describedBy("scheduledEndDate", false, errors.scheduledEndDate)}
              {...register("scheduledEndDate")}
            />
          </Field>

          <Field id="managerName" label="担当者" error={errors.managerName?.message}>
            <TextInput
              id="managerName"
              placeholder="現場 太郎"
              invalid={Boolean(errors.managerName)}
              aria-describedby={describedBy("managerName", false, errors.managerName)}
              {...register("managerName")}
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

          <Field id="notes" label="備考" className="md:col-span-2" error={errors.notes?.message}>
            <Textarea
              id="notes"
              rows={3}
              invalid={Boolean(errors.notes)}
              aria-describedby={describedBy("notes", false, errors.notes)}
              {...register("notes")}
            />
          </Field>
        </CardBody>
      </Card>

      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <LinkButton href={cancelHref} variant="secondary">
          キャンセル
        </LinkButton>
        <Button type="submit" loading={isSubmitting}>
          {isSubmitting ? "保存しています…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
