export type ArenaImageEntry = {
  patch: string;
  content: string;
  name: string;
  url: string;
};

export const arenaImages: ArenaImageEntry[] = [
  {
    patch: "6.1",
    content: "Dragonsong's Reprise (Ultimate)",
    name: "DSR P2 Arena Variant 1",
    url: "https://raw.githubusercontent.com/F1reman2/Arena-Images/refs/heads/main/6.1%20Ult%20DSR/DSR_P2a_Arena.png",
  },
];

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
  [...arenaImages, ...loaded].forEach((entry) => byUrl.set(entry.url, entry));
  return [...byUrl.values()].sort(compareArenaImages);
}
