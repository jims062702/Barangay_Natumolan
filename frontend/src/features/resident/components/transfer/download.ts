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

  const disposition = String(response.headers["content-disposition"] ?? "");
  const named = /filename="?([^"]+)"?/.exec(disposition);

  const url = URL.createObjectURL(response.data as Blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = named?.[1] ?? fallbackName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
