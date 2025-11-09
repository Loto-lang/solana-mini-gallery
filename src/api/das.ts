// src/api/das.ts

// --- Type definition for DAS assets ---
export type DasAsset = {
    id: string;
    content?: {
      json_uri?: string;
      metadata?: { name?: string; symbol?: string };
      links?: { image?: string };
      json?: { name?: string; symbol?: string; image?: string; attributes?: any[] };
    };
    grouping?: Array<{ group_key: string; group_value: string; verified?: boolean }>;
  };
  
  // --- RPC endpoint ---
  const RPC = import.meta.env.VITE_HELIUS_RPC as string;
  if (!RPC || RPC.includes('YOUR_KEY')) {
    console.warn('VITE_HELIUS_RPC missing or invalid. Set a valid Helius DAS URL.');
  }
  
  // --- Fetch all assets belonging to a given collection ---
  export async function getAssetsByCollection(collectionMint: string): Promise<DasAsset[]> {
    const acc: DasAsset[] = [];
    let page = 1;
    for (;;) {
      const body = {
        jsonrpc: '2.0',
        id: 'getAssetsByGroup',
        method: 'getAssetsByGroup',
        params: {
          groupKey: 'collection',
          groupValue: collectionMint,
          page,
          limit: 1000,
          sortBy: { sortBy: 'created', sortDirection: 'asc' },
        },
      };
      const res = await fetch(RPC, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      const items: DasAsset[] = json?.result?.items ?? [];
      acc.push(...items);
      if (items.length < 1000) break;
      page++;
    }
    return acc;
  }
  
  // --- Fetch all assets owned by a specific wallet address ---
  export async function getAssetsByOwner(owner: string): Promise<DasAsset[]> {
    const acc: DasAsset[] = [];
    let page = 1;
    for (;;) {
      const body = {
        jsonrpc: '2.0',
        id: 'getAssetsByOwner',
        method: 'getAssetsByOwner',
        params: {
          ownerAddress: owner,
          page,
          limit: 1000,
          displayOptions: { showCollectionMetadata: true },
        },
      };
      const res = await fetch(RPC, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      const items: DasAsset[] = json?.result?.items ?? [];
      acc.push(...items);
      if (items.length < 1000) break;
      page++;
    }
    return acc;
  }
  
  
  