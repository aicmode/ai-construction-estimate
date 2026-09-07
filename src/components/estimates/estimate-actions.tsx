"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { Copy, Download, ExternalLink, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { ESTIMATE_STATUSES, ESTIMATE_STATUS_LABELS, type EstimateStatus } from "@/lib/domain";
import {
  changeEstimateStatusAction,
  duplicateEstimateAction,
} from "@/server/actions/estimates";

export function StatusChanger({
  estimateId,
  currentStatus,
}: {
  estimateId: string;
  currentStatus: EstimateStatus;
}) {
  const router = useRouter();
  const toast = useToast();
  // `null` means "no pending choice", so the control falls back to the value
  // that came from the server. Clearing it after a save re-derives the state
  // from the refreshed prop without an effect.
  const [draft, setDraft] = React.useState<EstimateStatus | null>(null);
  const [pending, setPending] = React.useState(false);
  const status = draft ?? currentStatus;

  const apply = async () => {
    if (status === currentStatus) return;
    setPending(true);
    const result = await changeEstimateStatusAction({ estimateId, status });
    setPending(false);

    if (!result.ok) {
      toast.error(result.error);
      setDraft(null);
      return;
    }
    toast.success(`ステータスを「${ESTIMATE_STATUS_LABELS[status]}」に変更しました。`);
    setDraft(null);
    router.refresh();
  };

  return (
    <div className="flex items-end gap-2">
      <div className="min-w-0 flex-1">
        <label htmlFor="estimate-status" className="mb-1 block text-xs font-medium text-ink-muted">
          ステータス
        </label>
        <Select
          id="estimate-status"
          value={status}
          disabled={pending}
          onChange={(event) => setDraft(event.target.value as EstimateStatus)}
        >
          {ESTIMATE_STATUSES.map((value) => (
            <option key={value} value={value}>
              {ESTIMATE_STATUS_LABELS[value]}
            </option>
          ))}
        </Select>
      </div>
      <Button
        variant="secondary"
        onClick={apply}
        loading={pending}
        disabled={status === currentStatus}
      >
        変更
      </Button>
    </div>
  );
}

export function DuplicateButton({ estimateId }: { estimateId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = React.useState(false);

  const duplicate = async () => {
    setPending(true);
    const result = await duplicateEstimateAction(estimateId);
    setPending(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("見積を複製しました。");
    router.push(`/estimates/${result.data.id}`);
    router.refresh();
  };

  return (
    <Button variant="secondary" onClick={duplicate} loading={pending}>
      <Copy aria-hidden className="size-4" />
      {pending ? "複製しています…" : "複製"}
    </Button>
  );
}

/**
 * Downloads the server-generated PDF. The request goes to the authenticated
 * route handler, so the file is produced from the stored estimate rather than
 * from anything held in the browser.
 */
export function PdfButton({
  estimateId,
  estimateNumber,
}: {
  estimateId: string;
  estimateNumber: string;
}) {
  const toast = useToast();
  const [pending, setPending] = React.useState(false);

  const download = async () => {
    setPending(true);
    try {
      const response = await fetch(`/api/estimates/${estimateId}/pdf`, { cache: "no-store" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "PDFの生成に失敗しました。");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `見積書_${estimateNumber}.pdf`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      toast.success("見積書PDFを生成しました。");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "PDFの生成に失敗しました。");
    } finally {
      setPending(false);
    }
  };

  return (
    // Stacked: this block sits in a narrow sidebar column, where two buttons
    // side by side would wrap their labels mid-word.
    <div className="flex flex-col gap-2">
      <Button onClick={download} loading={pending} className="w-full">
        {pending ? (
          <>
            <Loader2 aria-hidden className="size-4 animate-spin" />
            PDFを生成しています…
          </>
        ) : (
          <>
            <Download aria-hidden className="size-4" />
            PDFをダウンロード
          </>
        )}
      </Button>
      <a
        href={`/api/estimates/${estimateId}/pdf`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-steel-300 bg-white px-4 text-[0.95rem] font-medium text-steel-800 hover:bg-steel-50"
      >
        <ExternalLink aria-hidden className="size-4" />
        別タブで開く
      </a>
    </div>
  );
}
