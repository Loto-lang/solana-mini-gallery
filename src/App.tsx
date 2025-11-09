// src/App.tsx
import { useState } from "react";
import { getAssetsByCollection } from "./api/das";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { ipfsToHttp } from "./utils/ipfs";

// Reusable disabled action button (UI only)
function DisabledBtn({ label, title }: { label: string; title?: string }) {
  return (
    <button
      disabled
      title={title || label}
      aria-disabled="true"
      style={{
        padding: "0.55rem 0.9rem",
        backgroundColor: "#e5e7eb",   // gray-200
        color: "#6b7280",             // gray-500
        border: "1px solid #d1d5db",  // gray-300
        borderRadius: 8,
        cursor: "not-allowed",
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}

// Small vertical divider for the toolbar
function VDivider() {
  return <div style={{ width: 1, height: 28, background: "#e5e7eb", margin: "0 0.5rem" }} />;
}

export default function App() {
  useWallet(); // context (needed for WalletMultiButton)

  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [onlyMine, setOnlyMine] = useState(false);

  const collection = import.meta.env.VITE_COLLECTION_MINT;

  async function load() {
    setLoading(true);
    try {
      const items = await getAssetsByCollection(collection);
      const enriched = await Promise.all(
        items.map(async (a: any) => {
          const metaUrl = ipfsToHttp(a.content?.json_uri);
          if (!metaUrl) return a;
          try {
            const r = await fetch(metaUrl, { cache: "no-store" });
            if (r.ok) {
              const meta = await r.json();
              const imgHttp = ipfsToHttp(meta?.image);
              a.content = a.content ?? {};
              a.content.json = { ...(a.content.json ?? {}), ...meta };
              a.content.links = { ...(a.content.links ?? {}), image: imgHttp };
            }
          } catch {}
          return a;
        })
      );
      setAssets(enriched);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Solana Mini Gallery (devnet)</h1>

      {/* Toolbar */}
      <div
        style={{
          marginBottom: "1rem",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          flexWrap: "wrap",
        }}
      >
        {/* Left side */}
        <button onClick={load} disabled={loading}>
          {loading ? "Loading..." : "Load"}
        </button>

        <label style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 8 }}>
          <input
            type="checkbox"
            checked={onlyMine}
            onChange={(e) => setOnlyMine(e.target.checked)}
          />
          <span>Only my items (connect wallet)</span>
        </label>

        {/* Right side */}
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            flexWrap: "wrap",
          }}
        >
          {/* Connect (active) */}
          <WalletMultiButton />

          <VDivider />

          {/* Planned actions (all disabled for now) */}
          <DisabledBtn label="Transfer" title="Transfer selected NFT" />
          <DisabledBtn label="Mint" title="Mint a new NFT" />
          <DisabledBtn label="Verify" title="Verify collection membership" />
          <DisabledBtn label="Airdrop" title="Airdrop to recipient" />
          <DisabledBtn label="Refresh" title="Reload metadata/cache" />
          <DisabledBtn label="Logs" title="Open debug logs" />
        </div>
      </div>

      <p style={{ color: "#666" }}>
        Collection: <b>{collection}</b>
      </p>

      {/* Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
          gap: "1rem",
          marginTop: "2rem",
        }}
      >
        {assets.map((a) => {
          const rawImg = a.content?.links?.image ?? a.content?.json?.image;
          const img = ipfsToHttp(rawImg) || "https://via.placeholder.com/250";
          const name = a.content?.metadata?.name ?? a.content?.json?.name;
          const verified =
            a.grouping?.find((g: any) => g.group_key === "collection")?.verified ?? false;

          return (
            <div
              key={a.id}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: "12px",
                overflow: "hidden",
                padding: "1rem",
                textAlign: "center",
              }}
            >
              <img src={img} alt={name} style={{ width: "100%", borderRadius: "8px" }} />
              <h3 style={{ marginTop: 12 }}>{name}</h3>
              <p
                style={{
                  fontSize: "0.75em",
                  color: "#999",
                  wordBreak: "break-all",
                  marginTop: 4,
                  lineHeight: 1.35,
                }}
              >
                {a.id}
              </p>
              <p style={{ fontSize: "0.9em", color: "#666", marginTop: 6 }}>
                {verified ? "✅ verified" : "unverified"}
              </p>
              <a
                href={ipfsToHttp(a.content?.json_uri)}
                target="_blank"
                rel="noreferrer"
                style={{ color: "#6b46c1", marginTop: 6, display: "inline-block" }}
              >
                metadata.json
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}
