import "server-only";

import React from "react";

import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";

import { ITEM_CATEGORY_LABELS, UNIT_LABELS, WORK_TYPE_LABELS, type WorkType } from "@/lib/domain";
import { formatQuantity, formatYenPlain } from "@/lib/money";
import type { CompanySettings } from "@/server/queries/company";
import type { EstimateDetail } from "@/server/queries/estimates";
import { FONT_FILES, wrapText } from "@/server/pdf/text";

const FONT_FAMILY = "NotoSansJP";
let fontsRegistered = false;

/** Registered once per lambda instance; repeated calls are a no-op. */
export function registerPdfFonts() {
  if (fontsRegistered) return;
  Font.register({
    family: FONT_FAMILY,
    fonts: [
      { src: FONT_FILES.regular, fontWeight: 400 },
      { src: FONT_FILES.bold, fontWeight: 700 },
    ],
  });
  // Line breaking is done up-front by `wrapText`, which measures with the very
  // same font. Disabling the built-in hyphenation engine stops react-pdf from
  // inserting a "-" in the middle of Japanese sentences.
  Font.registerHyphenationCallback((word) => [word]);
  fontsRegistered = true;
}

const PAGE_PADDING = 36;
const CONTENT_WIDTH = 595.28 - PAGE_PADDING * 2;

const COL = {
  no: 26,
  name: 269,
  quantity: 46,
  unit: 32,
  unitPrice: 70,
  amount: 80,
} as const;

const NAME_TEXT_WIDTH = COL.name - 10;

const ink = {
  text: "#111827",
  muted: "#4b5563",
  line: "#94a3b8",
  hairline: "#cbd5e1",
  headerBg: "#1e293b",
  headerText: "#ffffff",
  bandBg: "#f1f5f9",
  accent: "#b45309",
};

const styles = StyleSheet.create({
  page: {
    fontFamily: FONT_FAMILY,
    fontSize: 9,
    color: ink.text,
    paddingTop: PAGE_PADDING,
    paddingBottom: PAGE_PADDING + 14,
    paddingHorizontal: PAGE_PADDING,
    lineHeight: 1.4,
  },
  titleWrap: {
    alignSelf: "center",
    borderBottomWidth: 1.4,
    borderBottomColor: ink.accent,
    paddingBottom: 3,
    marginBottom: 14,
  },
  // An explicit lineHeight is required: without it react-pdf collapses the
  // wrapper height for a larger font size and the rule is drawn over the text.
  title: { fontSize: 20, fontWeight: 700, letterSpacing: 6, paddingLeft: 6, lineHeight: 1.4 },
  metaRow: { flexDirection: "row", justifyContent: "space-between" },
  metaCell: { flexDirection: "row", marginBottom: 2 },
  metaLabel: { width: 52, color: ink.muted },
  columns: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  leftColumn: { width: CONTENT_WIDTH * 0.52 },
  rightColumn: { width: CONTENT_WIDTH * 0.44 },
  customerName: { fontSize: 13, fontWeight: 700, borderBottomWidth: 0.8, borderBottomColor: ink.text, paddingBottom: 3 },
  muted: { color: ink.muted },
  companyName: { fontSize: 10.5, fontWeight: 700, marginBottom: 2 },
  totalBox: {
    borderWidth: 1,
    borderColor: ink.text,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  totalLabel: { fontSize: 10.5, fontWeight: 700 },
  totalValue: { fontSize: 17, fontWeight: 700 },
  subjectTable: { borderWidth: 0.5, borderColor: ink.hairline, marginBottom: 12 },
  subjectRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: ink.hairline },
  subjectRowLast: { flexDirection: "row" },
  subjectLabel: {
    width: 74,
    backgroundColor: ink.bandBg,
    paddingVertical: 4,
    paddingHorizontal: 6,
    color: ink.muted,
  },
  subjectValue: { flex: 1, paddingVertical: 4, paddingHorizontal: 8 },
  tableHeader: { flexDirection: "row", backgroundColor: ink.headerBg },
  th: { color: ink.headerText, fontWeight: 700, paddingVertical: 5, paddingHorizontal: 4, fontSize: 8.5 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: ink.hairline },
  cell: { paddingVertical: 4, paddingHorizontal: 4 },
  cellRight: { paddingVertical: 4, paddingHorizontal: 4, textAlign: "right" },
  cellCenter: { paddingVertical: 4, paddingHorizontal: 4, textAlign: "center" },
  itemDescription: { color: ink.muted, fontSize: 7.5, marginTop: 1 },
  summary: { marginTop: 10, flexDirection: "row", justifyContent: "flex-end" },
  summaryTable: { width: 230 },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: ink.hairline,
  },
  summaryTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: ink.text,
    marginTop: 2,
  },
  summaryTotalLabel: { fontWeight: 700, fontSize: 10.5 },
  summaryTotalValue: { fontWeight: 700, fontSize: 12 },
  notesBlock: { marginTop: 16, borderTopWidth: 0.5, borderTopColor: ink.hairline, paddingTop: 8 },
  notesGroup: { marginBottom: 8 },
  notesLabel: { fontWeight: 700, marginBottom: 2 },
  footer: {
    position: "absolute",
    bottom: 18,
    left: PAGE_PADDING,
    right: PAGE_PADDING,
    flexDirection: "row",
    justifyContent: "space-between",
    color: ink.muted,
    fontSize: 7.5,
  },
});

function formatJpDate(value: string | null): string {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${year}年${Number(month)}月${Number(day)}日`;
}

/** Renders text that has already been broken into lines by `wrapText`. */
function WrappedText({ lines, style }: { lines: string[]; style?: Style }) {
  return (
    <>
      {lines.map((line, index) => (
        <Text key={index} style={style}>
          {line === "" ? " " : line}
        </Text>
      ))}
    </>
  );
}

/** One compact muted line under the item name: category then the remark. */
function describeItem(category: keyof typeof ITEM_CATEGORY_LABELS, description: string): string {
  const label = ITEM_CATEGORY_LABELS[category];
  return description.trim() ? `${label} ／ ${description.trim()}` : label;
}

function MetaLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaCell}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text>{value}</Text>
    </View>
  );
}

function SubjectRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={last ? styles.subjectRowLast : styles.subjectRow}>
      <Text style={styles.subjectLabel}>{label}</Text>
      <View style={styles.subjectValue}>
        <WrappedText lines={wrapText(value || "—", CONTENT_WIDTH - 74 - 16, 9)} />
      </View>
    </View>
  );
}

export interface EstimatePdfProps {
  estimate: EstimateDetail;
  company: CompanySettings | null;
}

export function EstimatePdfDocument({ estimate, company }: EstimatePdfProps) {
  const customerDisplayName = estimate.customer.companyName || estimate.customer.name;
  const workTypeLabel = estimate.project
    ? WORK_TYPE_LABELS[estimate.project.workType as WorkType] ?? ""
    : "";

  return (
    <Document
      title={`見積書 ${estimate.estimate_number}`}
      author={company?.company_name || "見積書"}
      creator="AI Construction Estimate"
      producer="AI Construction Estimate"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>御見積書</Text>
        </View>

        <View style={styles.metaRow}>
          <View />
          <View>
            <MetaLine label="見積番号" value={estimate.estimate_number} />
            <MetaLine label="発行日" value={formatJpDate(estimate.issue_date)} />
            <MetaLine label="有効期限" value={formatJpDate(estimate.valid_until)} />
          </View>
        </View>

        <View style={styles.columns}>
          <View style={styles.leftColumn}>
            <View style={styles.customerName}>
              <WrappedText lines={wrapText(`${customerDisplayName} 御中`, CONTENT_WIDTH * 0.52, 13, "bold")} />
            </View>
            {estimate.customer.postalCode ? (
              <Text style={styles.muted}>〒{estimate.customer.postalCode}</Text>
            ) : null}
            {estimate.customer.address ? (
              <WrappedText lines={wrapText(estimate.customer.address, CONTENT_WIDTH * 0.52, 9)} style={styles.muted} />
            ) : null}
            {estimate.customer.contactName ? (
              <Text style={styles.muted}>{estimate.customer.contactName} 様</Text>
            ) : null}
            <Text style={{ marginTop: 8 }}>下記のとおりお見積り申し上げます。</Text>
          </View>

          <View style={styles.rightColumn}>
            <Text style={styles.companyName}>{company?.company_name || "（会社設定が未登録です）"}</Text>
            {company?.postal_code ? <Text style={styles.muted}>〒{company.postal_code}</Text> : null}
            {company?.address ? (
              <WrappedText lines={wrapText(company.address, CONTENT_WIDTH * 0.44, 9)} style={styles.muted} />
            ) : null}
            {company?.phone ? <Text style={styles.muted}>TEL {company.phone}</Text> : null}
            {company?.email ? <Text style={styles.muted}>{company.email}</Text> : null}
            {company?.contact_name ? <Text style={styles.muted}>担当 {company.contact_name}</Text> : null}
            {company?.invoice_registration_number ? (
              <Text style={styles.muted}>登録番号 {company.invoice_registration_number}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.totalBox}>
          <Text style={styles.totalLabel}>御見積金額（税込）</Text>
          <Text style={styles.totalValue}>¥{formatYenPlain(estimate.total_amount)}</Text>
        </View>

        <View style={styles.subjectTable}>
          <SubjectRow label="件名" value={estimate.title} />
          <SubjectRow
            label="工事名"
            value={estimate.project ? `${estimate.project.name}${workTypeLabel ? `（${workTypeLabel}）` : ""}` : "—"}
          />
          <SubjectRow label="施工場所" value={estimate.project?.siteAddress || estimate.customer.address || "—"} last />
        </View>

        <View style={styles.tableHeader} fixed>
          <Text style={[styles.th, { width: COL.no, textAlign: "center" }]}>No</Text>
          <Text style={[styles.th, { width: COL.name }]}>工事項目・摘要</Text>
          <Text style={[styles.th, { width: COL.quantity, textAlign: "right" }]}>数量</Text>
          <Text style={[styles.th, { width: COL.unit, textAlign: "center" }]}>単位</Text>
          <Text style={[styles.th, { width: COL.unitPrice, textAlign: "right" }]}>単価</Text>
          <Text style={[styles.th, { width: COL.amount, textAlign: "right" }]}>金額</Text>
        </View>

        {estimate.items.map((item, index) => (
          <View key={item.id} style={styles.row} wrap={false}>
            <Text style={[styles.cellCenter, { width: COL.no }]}>{index + 1}</Text>
            <View style={[styles.cell, { width: COL.name }]}>
              <WrappedText lines={wrapText(item.name, NAME_TEXT_WIDTH, 9)} />
              <WrappedText
                lines={wrapText(describeItem(item.category, item.description), NAME_TEXT_WIDTH, 7.5, "regular", 6)}
                style={styles.itemDescription}
              />
            </View>
            <Text style={[styles.cellRight, { width: COL.quantity }]}>{formatQuantity(item.quantity)}</Text>
            <Text style={[styles.cellCenter, { width: COL.unit }]}>{UNIT_LABELS[item.unit]}</Text>
            <Text style={[styles.cellRight, { width: COL.unitPrice }]}>{formatYenPlain(item.unit_price)}</Text>
            <Text style={[styles.cellRight, { width: COL.amount }]}>{formatYenPlain(item.amount)}</Text>
          </View>
        ))}

        <View style={styles.summary} wrap={false}>
          <View style={styles.summaryTable}>
            <View style={styles.summaryRow}>
              <Text>小計</Text>
              <Text>¥{formatYenPlain(estimate.items_subtotal)}</Text>
            </View>
            {estimate.discount_amount > 0 ? (
              <View style={styles.summaryRow}>
                <Text>値引き</Text>
                <Text>-¥{formatYenPlain(estimate.discount_amount)}</Text>
              </View>
            ) : null}
            <View style={styles.summaryRow}>
              <Text>税抜合計</Text>
              <Text>¥{formatYenPlain(estimate.subtotal_amount)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text>消費税（{estimate.tax_rate}%）</Text>
              <Text>¥{formatYenPlain(estimate.tax_amount)}</Text>
            </View>
            <View style={styles.summaryTotalRow}>
              <Text style={styles.summaryTotalLabel}>合計（税込）</Text>
              <Text style={styles.summaryTotalValue}>¥{formatYenPlain(estimate.total_amount)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.notesBlock}>
          <View style={styles.notesGroup} wrap={false}>
            <Text style={styles.notesLabel}>支払条件</Text>
            <WrappedText lines={wrapText(estimate.payment_terms || "—", CONTENT_WIDTH, 9)} style={styles.muted} />
          </View>
          <View style={styles.notesGroup}>
            <Text style={styles.notesLabel}>備考</Text>
            <WrappedText lines={wrapText(estimate.notes || "—", CONTENT_WIDTH, 9, "regular", 20)} style={styles.muted} />
          </View>
          {company?.bank_account ? (
            <View style={styles.notesGroup} wrap={false}>
              <Text style={styles.notesLabel}>振込先</Text>
              <WrappedText lines={wrapText(company.bank_account, CONTENT_WIDTH, 9)} style={styles.muted} />
            </View>
          ) : null}
        </View>

        {/*
          A static footer repeated on every page. react-pdf 4.9's dynamic
          `render` prop (the only way to obtain a page number) does not emit
          anything, so the estimate number is used to identify continuation
          pages instead.
        */}
        <View style={styles.footer} fixed>
          <Text>見積番号 {estimate.estimate_number}</Text>
          <Text>{company?.company_name || ""}</Text>
        </View>
      </Page>
    </Document>
  );
}
