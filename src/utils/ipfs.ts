// Convert "ipfs://<cid>/path" -> "https://.../ipfs/<cid>/path"
export function ipfsToHttp(uri?: string) {
  if (!uri) return "";
  if (/^https?:\/\//i.test(uri)) return uri;
  const gw = (import.meta as any).env?.VITE_IPFS_GATEWAY || "https://ipfs.io/ipfs/";
  return gw + uri.replace(/^ipfs:\/\//i, "").replace(/^ipfs\//i, "");
}
