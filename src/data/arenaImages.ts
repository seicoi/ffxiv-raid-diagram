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

type GitHubContent = {
  name: string;
  path: string;
  type: "file" | "dir";
  download_url: string | null;
  url: string;
};

const CONTENTS_API = "https://api.github.com/repos/F1reman2/Arena-Images/contents";

function parseFolder(folderName: string) {
  const [patch = "Unknown", ...rest] = folderName.split(" ");
  return { patch, content: rest.join(" ") || folderName };
}

function titleFromFile(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "").replace(/_/g, " ");
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

async function fetchContents(path = ""): Promise<GitHubContent[]> {
  const suffix = path ? `/${encodeURIComponent(path).replace(/%2F/g, "/")}` : "";
  const response = await fetch(`${CONTENTS_API}${suffix}?ref=main`, { headers: { Accept: "application/vnd.github+json" } });
  if (!response.ok) throw new Error(`Arena Images list failed: HTTP ${response.status}`);
  const data = await response.json();
  return Array.isArray(data) ? data as GitHubContent[] : [];
}

export async function loadArenaImagesFromGitHub(): Promise<ArenaImageEntry[]> {
  const root = await fetchContents();
  const folders = root.filter((item) => item.type === "dir");
  const lists = await Promise.all(folders.map(async (folder) => {
    const { patch, content } = parseFolder(folder.name);
    const files = await fetchContents(folder.path);
    return files
      .filter((file) => file.type === "file" && file.download_url && /\.(png|jpe?g|webp)$/i.test(file.name))
      .map((file) => ({ patch, content, name: titleFromFile(file.name), url: file.download_url! }));
  }));
  const loaded = lists.flat();
  const byUrl = new Map<string, ArenaImageEntry>();
  [...localFieldImages, ...remoteArenaImages, ...loaded].forEach((entry) => byUrl.set(entry.url, entry));
  return [...byUrl.values()].sort(compareArenaImages);
}
