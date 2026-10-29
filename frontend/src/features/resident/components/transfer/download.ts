import { api } from "../../../../shared/lib/api";

/**
 * Downloads through the API client, not a bare link.
 *
 * The export needs the bearer token, and an <a href> carries no headers —
 * it would come back as a 401 page saved with a .csv name, which looks like
 * a corrupt download rather than a permissions problem.
 */
export async function download(path: string, fallbackName: string) {
  const response = await api.get(path, { responseType: "blob" });

  if (response.data instanceof Blob && response.data.type?.includes("application/json")) {
    const text = await response.data.text();
    try {
      const json = JSON.parse(text);
      throw new Error(json.message || "Download failed");
    } catch (e: any) {
      if (e.message && e.message !== "Download failed") throw e;
    }
  }

  const disposition = String(response.headers["content-disposition"] ?? "");
  const match = /filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i.exec(disposition) || /filename="?([^"]+)"?/i.exec(disposition);

  const blob = response.data instanceof Blob ? response.data : new Blob([response.data]);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = match?.[1] ? decodeURIComponent(match[1].replace(/['"]/g, "")) : fallbackName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
