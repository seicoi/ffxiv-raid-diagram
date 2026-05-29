export type ArenaImageEntry = {
  patch: string;
  content: string;
  name: string;
  url: string;
};

export const localFieldImages: ArenaImageEntry[] = [
  { patch: "Local", content: "Field Images", name: "Circle Plaid", url: "field%20images/circle%20plaid.png" },
  { patch: "Local", content: "Field Images", name: "Circle Plain", url: "field%20images/circle%20plain.png" },
  { patch: "Local", content: "Field Images", name: "Rect Plaid", url: "field%20images/rect%20plaid.png" },
  { patch: "Local", content: "Field Images", name: "Rect Plain", url: "field%20images/rect%20plain.png" },
  { patch: "Local", content: "Field Images", name: "Square Plaid", url: "field%20images/square%20plaid.png" },
  { patch: "Local", content: "Field Images", name: "Square Plain", url: "field%20images/square%20plain.png" },
];
const remoteArenaImages: ArenaImageEntry[] = [
  {
    patch: "7.5",
    content: "Ult UMAD",
    name: "UMAD P1a Arena",
    url: "https://raw.githubusercontent.com/F1reman2/Arena-Images/refs/heads/main/7.5%20Ult%20UMAD/UMAD_P1a_Arena.png",
  },
  {
    patch: "7.5",
    content: "Ult UMAD",
    name: "UMAD P2a Arena",
    url: "https://raw.githubusercontent.com/F1reman2/Arena-Images/refs/heads/main/7.5%20Ult%20UMAD/UMAD_P2a_Arena.png",
  },
  {
    patch: "7.5",
    content: "Ult UMAD",
    name: "UMAD P2b Arena",
    url: "https://raw.githubusercontent.com/F1reman2/Arena-Images/refs/heads/main/7.5%20Ult%20UMAD/UMAD_P2b_Arena.png",
  },
  {
    patch: "6.1",
    content: "Ult DSR",
    name: "DSR P2a Arena",
    url: "https://raw.githubusercontent.com/F1reman2/Arena-Images/refs/heads/main/6.1%20Ult%20DSR/DSR_P2a_Arena.png",
  },
];

export const arenaImages: ArenaImageEntry[] = [...localFieldImages, ...remoteArenaImages];

type GitHubTreeItem = {
  path: string;
  type: "blob" | "tree";
};

type GitHubTreeResponse = {
  tree: GitHubTreeItem[];
  truncated?: boolean;
};

type GitHubContentItem = {
  name: string;
  path: string;
  type: "file" | "dir";
  download_url: string | null;
};

type JsDelivrFile = { name: string; type?: "file" | "directory"; files?: JsDelivrFile[] };
type JsDelivrPackageResponse = { files: JsDelivrFile[] };

const TREE_API = "https://api.github.com/repos/F1reman2/Arena-Images/git/trees/main?recursive=1";
const CONTENTS_API = "https://api.github.com/repos/F1reman2/Arena-Images/contents";
const REMOTE_FOLDERS = ["7.5 Ult UMAD", "7.4 Savage", "7.2 Savage", "7.1 Ult FRU", "7.0 Savage", "6.1 Ult DSR", "6.0 Savage", "6.0 Extreme", "5.0 Savage", "5.0 Extreme"];
const RAW_BASE = "https://raw.githubusercontent.com/F1reman2/Arena-Images/main";
const JSDELIVR_PACKAGE_API = "https://data.jsdelivr.com/v1/package/gh/F1reman2/Arena-Images@main";
const JSDELIVR_BASE = "https://cdn.jsdelivr.net/gh/F1reman2/Arena-Images@main";
const JINA_GITHUB_BASE = "https://r.jina.ai/https://github.com/F1reman2/Arena-Images/tree/main";

function parseFolder(folderName: string) {
  const [patch = "Unknown", ...rest] = folderName.split(" ");
  return { patch, content: rest.join(" ") || folderName };
}

function titleFromFile(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "").replace(/_/g, " ");
}

function encodePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function rawUrlFromPath(path: string) {
  return `${RAW_BASE}/${encodePath(path)}`;
}

function cdnUrlFromPath(path: string) {
  return `${JSDELIVR_BASE}/${encodePath(path)}`;
}

function compareArenaImages(a: ArenaImageEntry, b: ArenaImageEntry) {
  const aLocal = !/^https?:/i.test(a.url);
  const bLocal = !/^https?:/i.test(b.url);
  if (aLocal !== bLocal) return aLocal ? -1 : 1;
  const patchDelta = Number.parseFloat(b.patch) - Number.parseFloat(a.patch);
  if (Number.isFinite(patchDelta) && Math.abs(patchDelta) > 0.001) return patchDelta;
  if (a.content !== b.content) return b.content.localeCompare(a.content, undefined, { numeric: true });
  return a.name.localeCompare(b.name, undefined, { numeric: true });
}

function entryFromPath(path: string, url: string): ArenaImageEntry | null {
  const cleanPath = path.replace(/^\//, "");
  if (!/\.(png|jpe?g|webp)$/i.test(cleanPath) || !cleanPath.includes("/")) return null;
  const [folder, ...fileParts] = cleanPath.split("/");
  const fileName = fileParts.join("/").split("/").pop() ?? cleanPath;
  const { patch, content } = parseFolder(folder);
  return { patch, content, name: titleFromFile(fileName), url };
}
async function fetchImageTree(): Promise<ArenaImageEntry[]> {
  const response = await fetch(TREE_API, { headers: { Accept: "application/vnd.github+json" } });
  if (!response.ok) throw new Error(`Arena Images list failed: HTTP ${response.status}`);
  const data = await response.json() as GitHubTreeResponse;
  return (data.tree ?? [])
    .filter((item) => item.type === "blob")
    .map((item) => entryFromPath(item.path, rawUrlFromPath(item.path)))
    .filter((entry): entry is ArenaImageEntry => Boolean(entry));
}


async function fetchImageListFromGitHubPage(): Promise<ArenaImageEntry[]> {
  const loaded: ArenaImageEntry[] = [];
  for (const folder of REMOTE_FOLDERS) {
    const url = `${JINA_GITHUB_BASE}/${encodeURIComponent(folder)}`;
    const response = await fetch(url);
    if (!response.ok) continue;
    const text = await response.text();
    const names = [...new Set([...text.matchAll(/\b([A-Za-z0-9][A-Za-z0-9_ .-]*\.(?:png|jpe?g|webp))\b/gi)].map((match) => match[1]))];
    const { patch, content } = parseFolder(folder);
    names.forEach((name) => loaded.push({ patch, content, name: titleFromFile(name), url: rawUrlFromPath(`${folder}/${name}`) }));
  }
  if (!loaded.length) throw new Error("GitHub page fallback returned no images.");
  return loaded;
}
async function fetchImageListFromContents(): Promise<ArenaImageEntry[]> {
  const loaded: ArenaImageEntry[] = [];
  for (const folder of REMOTE_FOLDERS) {
    const url = `${CONTENTS_API}/${encodeURIComponent(folder)}?ref=main`;
    const response = await fetch(url, { headers: { Accept: "application/vnd.github+json" } });
    if (!response.ok) continue;
    const files = await response.json() as GitHubContentItem[];
    const { patch, content } = parseFolder(folder);
    files
      .filter((file) => file.type === "file" && file.download_url && /\.(png|jpe?g|webp)$/i.test(file.name))
      .forEach((file) => loaded.push({ patch, content, name: titleFromFile(file.name), url: file.download_url! }));
  }
  if (!loaded.length) throw new Error("Arena Images folder listing failed.");
  return loaded;
}
function flattenJsDelivrFiles(files: JsDelivrFile[], prefix = ""): string[] {
  return files.flatMap((file) => {
    const path = `${prefix}/${file.name}`.replace(/^\//, "");
    if (file.files?.length) return flattenJsDelivrFiles(file.files, path);
    return [path];
  });
}

async function fetchImageListFromJsDelivr(): Promise<ArenaImageEntry[]> {
  const response = await fetch(JSDELIVR_PACKAGE_API);
  if (!response.ok) throw new Error(`jsDelivr Arena Images list failed: HTTP ${response.status}`);
  const data = await response.json() as JsDelivrPackageResponse;
  return flattenJsDelivrFiles(data.files ?? [])
    .map((path) => entryFromPath(path, cdnUrlFromPath(path)))
    .filter((entry): entry is ArenaImageEntry => Boolean(entry));
}
export async function loadArenaImagesFromGitHub(): Promise<ArenaImageEntry[]> {
  let loaded: ArenaImageEntry[];
  try {
    loaded = await fetchImageTree();
  } catch {
    try {
      loaded = await fetchImageListFromContents();
    } catch {
      try {
        loaded = await fetchImageListFromGitHubPage();
      } catch {
        loaded = await fetchImageListFromJsDelivr();
      }
    }
  }
  const byUrl = new Map<string, ArenaImageEntry>();
  [...localFieldImages, ...remoteArenaImages, ...loaded].forEach((entry) => byUrl.set(entry.url, entry));
  return [...byUrl.values()].sort(compareArenaImages);
}