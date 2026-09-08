"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#0f0f11",
          color: "#e8e8ea",
          textAlign: "center",
          padding: "1rem",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Stat Padder hit an error</h1>
        <p style={{ color: "#a0a0a6", maxWidth: "24rem" }}>
          Reload the page. If it persists, the site is likely mid-deploy or a data source is down.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: "1.5rem",
            padding: "0.5rem 1.25rem",
            border: "2px solid #d63b2f",
            background: "transparent",
            color: "#e8e8ea",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
