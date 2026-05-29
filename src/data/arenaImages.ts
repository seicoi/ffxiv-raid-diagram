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

const TREE_API = "https://api.github.com/repos/F1reman2/Arena-Images/git/trees/main?recursive=1";
const RAW_BASE = "https://raw.githubusercontent.com/F1reman2/Arena-Images/main";

function parseFolder(folderName: string) {
  const [patch = "Unknown", ...rest] = folderName.split(" ");
  return { patch, content: rest.join(" ") || folderName };
}

function titleFromFile(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "").replace(/_/g, " ");
}

function rawUrlFromPath(path: string) {
  return `${RAW_BASE}/${path.split("/").map(encodeURIComponent).join("/")}`;
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

async function fetchImageTree(): Promise<ArenaImageEntry[]> {
  const response = await fetch(TREE_API, { headers: { Accept: "application/vnd.github+json" } });
  if (!response.ok) throw new Error(`Arena Images list failed: HTTP ${response.status}`);
  const data = await response.json() as GitHubTreeResponse;
  return (data.tree ?? [])
    .filter((item) => item.type === "blob" && /\.(png|jpe?g|webp)$/i.test(item.path) && item.path.includes("/"))
    .map((item) => {
      const [folder, ...fileParts] = item.path.split("/");
      const fileName = fileParts.join("/").split("/").pop() ?? item.path;
      const { patch, content } = parseFolder(folder);
      return { patch, content, name: titleFromFile(fileName), url: rawUrlFromPath(item.path) };
    });
}

export async function loadArenaImagesFromGitHub(): Promise<ArenaImageEntry[]> {
  const loaded = await fetchImageTree();
  const byUrl = new Map<string, ArenaImageEntry>();
  [...localFieldImages, ...remoteArenaImages, ...loaded].forEach((entry) => byUrl.set(entry.url, entry));
  return [...byUrl.values()].sort(compareArenaImages);
}