"use client";

/**
 * Last-resort boundary: it replaces the whole document, so it cannot rely on
 * the application layout or Tailwind's runtime classes being present.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ja">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0b1421",
          color: "#eaf0f6",
          fontFamily: "system-ui, sans-serif",
          padding: "2rem",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: "28rem" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600 }}>
            予期しないエラーが発生しました
          </h1>
          <p style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "#8ba0b8" }}>
            アプリケーションを読み込めませんでした。再読み込みをお試しください。
          </p>
          {error.digest ? (
            <p style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "#647893" }}>
              エラーID: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.5rem",
              height: "2.75rem",
              padding: "0 1.25rem",
              borderRadius: "0.375rem",
              border: "none",
              backgroundColor: "#d97706",
              color: "#ffffff",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            再読み込み
          </button>
        </div>
      </body>
    </html>
  );
}
