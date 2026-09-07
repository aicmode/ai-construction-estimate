import { NextResponse } from "next/server";

import { renderToBuffer } from "@react-pdf/renderer";

import { getOrgContext } from "@/server/auth";
import { EstimatePdfDocument, registerPdfFonts } from "@/server/pdf/estimate-document";
import { getCompanySettings } from "@/server/queries/company";
import { getEstimateDetail } from "@/server/queries/estimates";
import { uuid } from "@/lib/validation/common";

/**
 * `@react-pdf/renderer` needs the Node.js runtime (it reads font files from the
 * bundle and uses Node streams); it does not run on the Edge runtime.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const parsedId = uuid.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json({ error: "見積IDが不正です。" }, { status: 400 });
  }

  const context = await getOrgContext();
  if (!context) {
    return NextResponse.json({ error: "認証が必要です。" }, { status: 401 });
  }

  try {
    // Scoped to the caller's organization; an id from another tenant simply
    // returns 404 rather than revealing that the row exists.
    const estimate = await getEstimateDetail(context.organizationId, parsedId.data);
    if (!estimate) {
      return NextResponse.json({ error: "見積が見つかりません。" }, { status: 404 });
    }

    const company = await getCompanySettings(context.organizationId);

    registerPdfFonts();
    const buffer = await renderToBuffer(
      <EstimatePdfDocument estimate={estimate} company={company} />,
    );

    const filename = `estimate-${estimate.estimate_number}.pdf`;
    const utf8Name = encodeURIComponent(`見積書_${estimate.estimate_number}.pdf`);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="${filename}"; filename*=UTF-8''${utf8Name}`,
        "content-length": String(buffer.length),
        "cache-control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("[pdf]", error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: "PDFの生成に失敗しました。時間をおいて再度お試しください。" },
      { status: 500 },
    );
  }
}
