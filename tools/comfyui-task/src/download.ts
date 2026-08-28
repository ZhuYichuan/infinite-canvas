// Download a single asset's bytes from the proxy.

export interface DownloadResult {
    bytes: Blob;
    content_type: string;
}

export async function downloadAsset(
    baseUrl: string,
    token: string | undefined,
    assetId: string,
    signal?: AbortSignal,
): Promise<DownloadResult> {
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${baseUrl}/api/v2/assets/${assetId}/content`, { headers, signal });
    if (!res.ok) throw new Error(`Download failed for asset ${assetId}: ${res.status} ${res.statusText}`);
    const contentType = res.headers.get("content-type") ?? "application/octet-stream";
    const bytes = await res.blob();
    return { bytes, content_type: contentType };
}