// Comments in English — Node polyfills must run BEFORE any Solana imports
import { Buffer } from 'buffer';
if (!(globalThis as any).Buffer) (globalThis as any).Buffer = Buffer;
if (!(globalThis as any).process) (globalThis as any).process = { env: {} };

import React from 'react';
import ReactDOM from 'react-dom/client';
import { useMemo, useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { getAssetsByCollection, getAssetsByOwner } from './api/das';
import { PublicKey, Transaction } from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';

import '@solana/wallet-adapter-react-ui/styles.css';
import './index.css';

// --- IPFS gateway helper (Pinata by default, overridable via .env) ---
const IPFS_GATEWAY =
  import.meta.env.VITE_IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs/';
const ipfsToHttp = (u?: string) =>
  !u ? '' : u.startsWith('ipfs://') ? IPFS_GATEWAY + u.slice(7) : u;
// ---------------------------------------------------------------------

type Card = {
  id: string;
  name: string;
  image?: string;
  symbol?: string;
  verified: boolean;
  jsonUri?: string;
  mint: string;
};

const COLLECTION = import.meta.env.VITE_COLLECTION_MINT as string;

function App() {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const owner = useMemo(() => publicKey?.toBase58() ?? '', [publicKey]);

  const [loading, setLoading] = useState(false);
  const [onlyMine, setOnlyMine] = useState(false);
  const [cards, setCards] = useState<Card[]>([]);
  const [transferTo, setTransferTo] = useState<string>('');
  const [txStatus, setTxStatus] = useState<string>('');

  // Load NFTs from Helius DAS
  async function load() {
    setLoading(true);
    try {
      const assets =
        onlyMine && owner
          ? (await getAssetsByOwner(owner)).filter(a =>
              (a.grouping || []).some(
                g => g.group_key === 'collection' && g.group_value === COLLECTION,
              ),
            )
          : await getAssetsByCollection(COLLECTION);

      const mapped: Card[] = assets.map((a: any) => {
        const name = a.content?.metadata?.name ?? a.content?.json?.name ?? a.id;
        const symbol = a.content?.metadata?.symbol ?? a.content?.json?.symbol;
        // Prefer links.image, then JSON/metadata image. Convert ipfs:// -> gateway.
        const imageRaw =
          a.content?.links?.image ||
          a.content?.json?.image ||
          a.content?.metadata?.image;
        const image = ipfsToHttp(imageRaw);
        const group = (a.grouping || []).find((g: any) => g.group_key === 'collection');
        const verified = !!group?.verified;
        return {
          id: a.id,
          name,
          image,
          symbol,
          verified,
          jsonUri: a.content?.json_uri, // keep ipfs:// here; convert at render
          mint: a.id,
        };
      });

      setCards(mapped);
    } catch (err) {
      console.error('Load failed', err);
    } finally {
      setLoading(false);
    }
  }

  // Transfer an NFT (SPL Token 2022 compatible)
  async function transferNft(nftMint: string) {
    try {
      setTxStatus('Preparing transaction…');
      if (!publicKey || !signTransaction) throw new Error('Wallet not connected');
      if (!transferTo) throw new Error('Recipient address is empty');

      const recipient = new PublicKey(transferTo);
      const mintPk = new PublicKey(nftMint);
      const ownerPk = publicKey;

      const fromAta = await getAssociatedTokenAddress(mintPk, ownerPk, false, TOKEN_PROGRAM_ID);
      const toAta = await getAssociatedTokenAddress(mintPk, recipient, false, TOKEN_PROGRAM_ID);

      const ixs = [];
      const toAtaInfo = await connection.getAccountInfo(toAta);
      if (!toAtaInfo) {
        ixs.push(
          createAssociatedTokenAccountInstruction(
            ownerPk,   // payer
            toAta,     // ata to create
            recipient, // owner
            mintPk,    // mint
            TOKEN_PROGRAM_ID,
          ),
        );
      }

      ixs.push(createTransferInstruction(fromAta, toAta, ownerPk, 1, [], TOKEN_PROGRAM_ID));

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      const tx = new Transaction({ feePayer: ownerPk, recentBlockhash: blockhash }).add(...ixs);

      setTxStatus('Signing…');
      const signed = await signTransaction(tx);

      setTxStatus('Sending…');
      const sig = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });

      setTxStatus(`Sent. Signature: ${sig}`);
      await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
      setTxStatus(`✅ Confirmed: ${sig}`);
    } catch (e: any) {
      setTxStatus(`❌ Transfer failed: ${e?.message ?? e}`);
      console.error(e);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="max-w-5xl mx-auto px-4 py-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Solana Mini Gallery (devnet)</h1>
        <WalletMultiButton />
      </header>

      <main className="max-w-5xl mx-auto px-4 pb-12">
        <section className="mb-6 space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={load}
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-black text-white disabled:opacity-60"
            >
              {loading ? 'Loading…' : 'Load'}
            </button>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={onlyMine}
                onChange={e => setOnlyMine(e.target.checked)}
                disabled={!owner}
              />
              Only my items{' '}
              {owner ? (
                <span className="font-mono text-gray-600">
                  ({owner.slice(0, 4)}…{owner.slice(-4)})
                </span>
              ) : (
                '(connect wallet)'
              )}
            </label>

            <div className="flex items-center gap-2 text-sm">
              <span>Recipient:</span>
              <input
                placeholder="Recipient address"
                value={transferTo}
                onChange={e => setTransferTo(e.target.value)}
                className="px-2 py-1 border rounded-md w-72"
              />
            </div>
          </div>

          <p className="text-sm text-gray-500">
            Collection:{' '}
            <span className="font-mono">
              {COLLECTION || '— set VITE_COLLECTION_MINT in .env.local —'}
            </span>
          </p>

          {txStatus && <p className="text-sm">{txStatus}</p>}
        </section>

        <section>
          {cards.length === 0 && !loading && (
            <div className="text-gray-500">No items yet. Click “Load”.</div>
          )}
          <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {cards.map(c => (
              <li key={c.id} className="bg-white rounded-2xl shadow p-3">
                <div className="aspect-square rounded-xl overflow-hidden bg-gray-100 mb-3">
                  {c.image ? (
                    <img
                      src={ipfsToHttp(c.image)}
                      alt={c.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      No image
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-gray-500">{c.symbol}</div>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      c.verified ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {c.verified ? 'verified' : 'unverified'}
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => transferNft(c.mint)}
                    disabled={!publicKey || !transferTo}
                    className="text-sm px-3 py-1 rounded-lg bg-indigo-600 text-white disabled:opacity-50"
                  >
                    Transfer
                  </button>
                  {c.jsonUri && (
                    <a
                      href={ipfsToHttp(c.jsonUri)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-blue-600"
                    >
                      metadata.json
                    </a>
                  )}
                </div>

                <div className="text-[10px] text-gray-400 mt-1 break-all font-mono">{c.id}</div>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
