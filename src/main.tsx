import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Download,
  Eye,
  EyeOff,
  FileDown,
  Grid3X3,
  HelpCircle,
  ImagePlus,
  Lock,
  LockOpen,
  PanelLeft,
  Redo2,
  Save,
  Settings,
  Trash2,
  Undo2,
  Upload,
} from "lucide-react";
import { arenaImages, loadArenaImagesFromGitHub, type ArenaImageEntry } from "./data/arenaImages";
import { clearAutoSave, hasAutoSave, loadAutoSave, saveAutoSave, type AutoSaveEnvelope } from "./storage";
import "./styles.css";

type AssetCategory = "Players" | "Boss" | "AoE" | "Markers" | "Field Markers" | "Buffs" | "Debuffs" | "Custom";
type FieldGuide =
  | { mode: "circle"; centerX: number; centerY: number; radiusPx: number; radiusM: number }
  | { mode: "rect"; x: number; y: number; widthPx: number; heightPx: number; widthM: number; heightM: number };
type BackgroundImage = { id: string; name: string; href: string; naturalWidth: number; naturalHeight: number; x: number; y: number; width: number; height: number; opacity: number; visible: boolean; locked: boolean; sourceUrl?: string };
type LibraryAsset = { id: string; name: string; category: AssetCategory; href: string; tags: string[]; source: "default" | "import"; iconHref?: string };
type AppliedIcon = { id: string; assetId: string; visible: boolean };
type CombatObject = { id: string; kind: "player" | "boss"; label: string; assetId: string; href: string; x: number; y: number; widthM: number; heightM: number; rotation: number; opacity: number; visible: boolean; locked: boolean; buffs: AppliedIcon[]; debuffs: AppliedIcon[] };
type ImageObject = { id: string; label: string; assetId: string; href: string; x: number; y: number; widthM: number; heightM: number; rotation: number; opacity: number; visible: boolean; locked: boolean; folderId?: string | null; renderMode?: "image" | "fan"; arcAngleDeg?: number };
type CircleAoe = { id: string; kind: "circle"; label: string; x: number; y: number; radiusM: number; color: string; opacity: number; visible: boolean; locked: boolean };
type RectAoe = { id: string; kind: "rect"; label: string; x: number; y: number; widthM: number; heightM: number; rotation: number; color: string; opacity: number; visible: boolean; locked: boolean };
type FanAoe = { id: string; kind: "fan"; label: string; x: number; y: number; radiusM: number; angleDeg: number; directionDeg: number; color: string; opacity: number; visible: boolean; locked: boolean };
type DonutAoe = { id: string; kind: "donut"; label: string; x: number; y: number; outerRadiusM: number; innerRadiusM: number; color: string; opacity: number; visible: boolean; locked: boolean };
type TetherAoe = { id: string; kind: "tether"; label: string; x: number; y: number; lengthM: number; strokeWidthM: number; directionDeg: number; color: string; opacity: number; visible: boolean; locked: boolean };
type ArrowAoe = { id: string; kind: "arrow"; label: string; x: number; y: number; lengthM: number; strokeWidthM: number; directionDeg: number; color: string; opacity: number; visible: boolean; locked: boolean };
type Aoe = CircleAoe | RectAoe | FanAoe | DonutAoe | TetherAoe | ArrowAoe;
type LayerFolder = { id: string; label: string; itemIds: string[]; expanded: boolean; visible: boolean; locked: boolean };
type SceneState = { background: BackgroundImage | null; backgrounds: BackgroundImage[]; activeBackgroundId: string | null; field: FieldGuide; fieldGuideVisible: boolean; fieldGuideLocked: boolean; objects: CombatObject[]; imageObjects: ImageObject[]; aoes: Aoe[]; folders: LayerFolder[]; layerOrder: string[]; snap: DiagramState["snap"] };
type SceneSnapshot = { id: string; name: string; notes: string; state: SceneState };
type AutoSaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";
type ConfirmDialog = { title: string; message: string; confirmLabel: string; cancelLabel: string };
type DiagramState = {
  version: 1;
  activeSceneId: string | null;
  scenes: SceneSnapshot[];
  background: BackgroundImage | null;
  backgrounds: BackgroundImage[];
  activeBackgroundId: string | null;
  field: FieldGuide;
  fieldGuideVisible: boolean;
  fieldGuideLocked: boolean;
  objects: CombatObject[];
  imageObjects: ImageObject[];
  aoes: Aoe[];
  assets: LibraryAsset[];
  folders: LayerFolder[];
  layerOrder: string[];
  snap: { grid: boolean; gridVisible: boolean; gridSizeM: number; gridOpacity: number; minorColor: string; majorColor: string };
};

const categories: AssetCategory[] = ["Players", "Boss", "AoE", "Markers", "Field Markers", "Buffs", "Debuffs", "Custom"];
const canvasSize = { width: 1024, height: 1024 };
const defaultField: FieldGuide = { mode: "circle", centerX: 512, centerY: 512, radiusPx: 360, radiusM: 20 };

function inferTags(name: string): string[] {
  const normalized = name.toLowerCase().replace(/_/g, " ");
  const tags = new Set<string>();
  if (normalized.includes("stack")) tags.add("stack");
  if (normalized.includes("spread")) tags.add("spread");
  if (normalized.includes("gaze")) tags.add("gaze");
  if (normalized.includes("tower")) tags.add("tower");
  if (normalized.includes("clockwise") || normalized.includes("direction")) tags.add("direction");
  if (normalized.includes("knockback")) tags.add("knockback");
  if (normalized.includes("proximity")) tags.add("proximity");
  if (normalized.includes("tankbuster")) tags.add("tankbuster");
  if (tags.size === 0) tags.add("misc");
  return [...tags];
}

const defaultAssets: LibraryAsset[] = [
  { id: "default-aoe-circle-aoe", name: "circle aoe", category: "AoE", href: "assets/AoE/circle%20aoe.png", tags: inferTags("circle aoe"), source: "default" },
  { id: "default-aoe-fan-aoe", name: "fan aoe", category: "AoE", href: "assets/AoE/circle%20aoe.png", iconHref: "assets/AoE/fan%20aoe.png", tags: ["fan", "image-aoe"], source: "default" },
  { id: "default-aoe-donut", name: "donut", category: "AoE", href: "assets/AoE/donut.png", tags: inferTags("donut"), source: "default" },
  { id: "default-aoe-line-aoe", name: "line aoe", category: "AoE", href: "assets/AoE/line%20aoe.png", tags: inferTags("line aoe"), source: "default" },
  { id: "default-aoe-linear-knockback", name: "linear knockback", category: "AoE", href: "assets/AoE/linear%20knockback.png", tags: inferTags("linear knockback"), source: "default" },
  { id: "default-aoe-moving-circle-aoe", name: "moving circle aoe", category: "AoE", href: "assets/AoE/moving%20circle%20aoe.png", tags: inferTags("moving circle aoe"), source: "default" },
  { id: "default-aoe-proximity", name: "proximity", category: "AoE", href: "assets/AoE/proximity.png", tags: inferTags("proximity"), source: "default" },
  { id: "default-aoe-radial-knockback", name: "radial knockback", category: "AoE", href: "assets/AoE/radial%20knockback.png", tags: inferTags("radial knockback"), source: "default" },
  { id: "default-aoe-tether", name: "tether", category: "AoE", href: "assets/AoE/tether.png", tags: inferTags("tether"), source: "default" },
  { id: "default-aoe-tower", name: "tower", category: "AoE", href: "assets/AoE/tower.png", tags: inferTags("tower"), source: "default" },
  { id: "default-boss-large-enemy", name: "large enemy", category: "Boss", href: "assets/Boss/large%20enemy.png", tags: inferTags("large enemy"), source: "default" },
  { id: "default-boss-medium-enemy", name: "medium enemy", category: "Boss", href: "assets/Boss/medium%20enemy.png", tags: inferTags("medium enemy"), source: "default" },
  { id: "default-boss-small-enemy", name: "small enemy", category: "Boss", href: "assets/Boss/small%20enemy.png", tags: inferTags("small enemy"), source: "default" },
  { id: "default-markers-clockwise", name: "clockwise", category: "Markers", href: "assets/Markers/clockwise.png", tags: inferTags("clockwise"), source: "default" },
  { id: "default-markers-counterclockwise", name: "counterclockwise", category: "Markers", href: "assets/Markers/counterclockwise.png", tags: inferTags("counterclockwise"), source: "default" },
  { id: "default-markers-gaze", name: "gaze", category: "Markers", href: "assets/Markers/gaze.png", tags: inferTags("gaze"), source: "default" },
  { id: "default-markers-highlighted-circle", name: "highlighted circle", category: "Markers", href: "assets/Markers/highlighted%20circle.png", tags: inferTags("highlighted circle"), source: "default" },
  { id: "default-markers-highlighted-square", name: "highlighted square", category: "Markers", href: "assets/Markers/highlighted%20square.png", tags: inferTags("highlighted square"), source: "default" },
  { id: "default-markers-highlighted-triangle", name: "highlighted triangle", category: "Markers", href: "assets/Markers/highlighted%20triangle.png", tags: inferTags("highlighted triangle"), source: "default" },
  { id: "default-markers-highlighted-x", name: "highlighted x", category: "Markers", href: "assets/Markers/highlighted%20x.png", tags: inferTags("highlighted x"), source: "default" },
  { id: "default-markers-lockon-blue", name: "lockon_blue", category: "Markers", href: "assets/Markers/lockon_blue.png", tags: inferTags("lockon_blue"), source: "default" },
  { id: "default-markers-lockon-green", name: "lockon_green", category: "Markers", href: "assets/Markers/lockon_green.png", tags: inferTags("lockon_green"), source: "default" },
  { id: "default-markers-lockon-purple", name: "lockon_purple", category: "Markers", href: "assets/Markers/lockon_purple.png", tags: inferTags("lockon_purple"), source: "default" },
  { id: "default-markers-lockon-red", name: "lockon_red", category: "Markers", href: "assets/Markers/lockon_red.png", tags: inferTags("lockon_red"), source: "default" },
  { id: "default-markers-proximity-player", name: "proximity_player", category: "Markers", href: "assets/Markers/proximity_player.png", tags: inferTags("proximity_player"), source: "default" },
  { id: "default-markers-tankbuster", name: "tankbuster", category: "Markers", href: "assets/Markers/tankbuster.png", tags: inferTags("tankbuster"), source: "default" },
  { id: "default-field-markers-waymark-1", name: "waymark 1", category: "Field Markers", href: "assets/Field%20Markers/waymark%201.png", tags: ["field-marker"], source: "default" },
  { id: "default-field-markers-waymark-2", name: "waymark 2", category: "Field Markers", href: "assets/Field%20Markers/waymark%202.png", tags: ["field-marker"], source: "default" },
  { id: "default-field-markers-waymark-3", name: "waymark 3", category: "Field Markers", href: "assets/Field%20Markers/waymark%203.png", tags: ["field-marker"], source: "default" },
  { id: "default-field-markers-waymark-4", name: "waymark 4", category: "Field Markers", href: "assets/Field%20Markers/waymark%204.png", tags: ["field-marker"], source: "default" },
  { id: "default-field-markers-waymark-a", name: "waymark a", category: "Field Markers", href: "assets/Field%20Markers/waymark%20a.png", tags: ["field-marker"], source: "default" },
  { id: "default-field-markers-waymark-b", name: "waymark b", category: "Field Markers", href: "assets/Field%20Markers/waymark%20b.png", tags: ["field-marker"], source: "default" },
  { id: "default-field-markers-waymark-c", name: "waymark c", category: "Field Markers", href: "assets/Field%20Markers/waymark%20c.png", tags: ["field-marker"], source: "default" },
  { id: "default-field-markers-waymark-d", name: "waymark d", category: "Field Markers", href: "assets/Field%20Markers/waymark%20d.png", tags: ["field-marker"], source: "default" },
  { id: "default-players-t1", name: "T1", category: "Players", href: "assets/Players/T1.png", tags: ["role"], source: "default" },
  { id: "default-players-t2", name: "T2", category: "Players", href: "assets/Players/T2.png", tags: ["role"], source: "default" },
  { id: "default-players-h1", name: "H1", category: "Players", href: "assets/Players/H1.png", tags: ["role"], source: "default" },
  { id: "default-players-h2", name: "H2", category: "Players", href: "assets/Players/H2.png", tags: ["role"], source: "default" },
  { id: "default-players-d1", name: "D1", category: "Players", href: "assets/Players/D1.png", tags: ["role"], source: "default" },
  { id: "default-players-d2", name: "D2", category: "Players", href: "assets/Players/D2.png", tags: ["role"], source: "default" },
  { id: "default-players-d3", name: "D3", category: "Players", href: "assets/Players/D3.png", tags: ["role"], source: "default" },
  { id: "default-players-d4", name: "D4", category: "Players", href: "assets/Players/D4.png", tags: ["role"], source: "default" },
  { id: "default-players-paladin", name: "paladin", category: "Players", href: "assets/Players/paladin.png", tags: inferTags("paladin"), source: "default" },
  { id: "default-players-warrior", name: "warrior", category: "Players", href: "assets/Players/warrior.png", tags: inferTags("warrior"), source: "default" },
  { id: "default-players-darkknight", name: "darkknight", category: "Players", href: "assets/Players/darkknight.png", tags: inferTags("darkknight"), source: "default" },
  { id: "default-players-gunbreaker", name: "gunbreaker", category: "Players", href: "assets/Players/gunbreaker.png", tags: inferTags("gunbreaker"), source: "default" },
  { id: "default-players-whitemage", name: "whitemage", category: "Players", href: "assets/Players/whitemage.png", tags: inferTags("whitemage"), source: "default" },
  { id: "default-players-scholar", name: "scholar", category: "Players", href: "assets/Players/scholar.png", tags: inferTags("scholar"), source: "default" },
  { id: "default-players-astrologian", name: "astrologian", category: "Players", href: "assets/Players/astrologian.png", tags: inferTags("astrologian"), source: "default" },
  { id: "default-players-sage", name: "sage", category: "Players", href: "assets/Players/sage.png", tags: inferTags("sage"), source: "default" },
  { id: "default-players-monk", name: "monk", category: "Players", href: "assets/Players/monk.png", tags: inferTags("monk"), source: "default" },
  { id: "default-players-dragoon", name: "dragoon", category: "Players", href: "assets/Players/dragoon.png", tags: inferTags("dragoon"), source: "default" },
  { id: "default-players-ninja", name: "ninja", category: "Players", href: "assets/Players/ninja.png", tags: inferTags("ninja"), source: "default" },
  { id: "default-players-samurai", name: "samurai", category: "Players", href: "assets/Players/samurai.png", tags: inferTags("samurai"), source: "default" },
  { id: "default-players-reaper", name: "reaper", category: "Players", href: "assets/Players/reaper.png", tags: inferTags("reaper"), source: "default" },
  { id: "default-players-viper", name: "viper", category: "Players", href: "assets/Players/viper.png", tags: inferTags("viper"), source: "default" },
  { id: "default-players-bard", name: "bard", category: "Players", href: "assets/Players/bard.png", tags: inferTags("bard"), source: "default" },
  { id: "default-players-machinist", name: "machinist", category: "Players", href: "assets/Players/machinist.png", tags: inferTags("machinist"), source: "default" },
  { id: "default-players-dancer", name: "dancer", category: "Players", href: "assets/Players/dancer.png", tags: inferTags("dancer"), source: "default" },
  { id: "default-players-blackmage", name: "blackmage", category: "Players", href: "assets/Players/blackmage.png", tags: inferTags("blackmage"), source: "default" },
  { id: "default-players-summoner", name: "summoner", category: "Players", href: "assets/Players/summoner.png", tags: inferTags("summoner"), source: "default" },
  { id: "default-players-redmage", name: "redmage", category: "Players", href: "assets/Players/redmage.png", tags: inferTags("redmage"), source: "default" },
  { id: "default-players-pictmancer", name: "pictmancer", category: "Players", href: "assets/Players/pictmancer.png", tags: inferTags("pictmancer"), source: "default" },];
const playerAssetOrder = ["T1", "T2", "H1", "H2", "D1", "D2", "D3", "D4", "M1", "M2", "R1", "R2", "paladin", "warrior", "darkknight", "gunbreaker", "whitemage", "scholar", "astrologian", "sage", "monk", "dragoon", "ninja", "samurai", "reaper", "viper", "bard", "machinist", "dancer", "blackmage", "summoner", "redmage", "pictmancer"];
const playerAssetRank = new Map(playerAssetOrder.map((name, index) => [name.toLowerCase(), index]));
function sortAssetsForCategory(category: AssetCategory, assets: LibraryAsset[]) {
  if (category !== "Players") return assets;
  return [...assets].sort((a, b) => {
    const rankA = playerAssetRank.get(a.name.toLowerCase()) ?? Number.MAX_SAFE_INTEGER;
    const rankB = playerAssetRank.get(b.name.toLowerCase()) ?? Number.MAX_SAFE_INTEGER;
    if (rankA !== rankB) return rankA - rankB;
    return a.name.localeCompare(b.name, undefined, { numeric: true });
  });
}
const initialState: DiagramState = {
  version: 1,
  activeSceneId: null,
  scenes: [],
  background: null,
  backgrounds: [],
  activeBackgroundId: null,
  field: defaultField,
  fieldGuideVisible: true,
  fieldGuideLocked: false,
  objects: [],
  imageObjects: [],
  aoes: [],
  assets: defaultAssets,
  folders: [],
  layerOrder: [],
  snap: { grid: true, gridVisible: true, gridSizeM: 1, gridOpacity: 0.55, minorColor: "#89a6c7", majorColor: "#d0e6ff" },
};

function NumberInput({ value, onChange, min, max, step, disabled }: { value: number; onChange: (value: number) => void; min?: number; max?: number; step?: number; disabled?: boolean }) {
  const [draft, setDraft] = useState(String(value));
  const ref = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (document.activeElement !== ref.current) setDraft(String(value));
  }, [value]);
  const commit = () => {
    const next = draft === "" ? 0 : Number(draft);
    if (Number.isFinite(next)) onChange(next);
    if (draft === "") setDraft("0");
  };
  return <input ref={ref} type="number" value={draft} min={min} max={max} step={step} disabled={disabled} onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && ref.current?.blur()} />;
}

function readRaster(file: File): Promise<{ href: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const href = String(reader.result);
      const image = new Image();
      image.onload = () => resolve({ href, width: image.naturalWidth || 1024, height: image.naturalHeight || 1024 });
      image.onerror = reject;
      image.src = href;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
async function readRasterUrl(url: string): Promise<{ href: string; width: number; height: number }> {
  let response: Response;
  try {
    response = await fetch(url, { mode: "cors" });
  } catch {
    throw new Error("Arena Image could not be loaded. CORS or network access may be blocked.");
  }
  if (!response.ok) throw new Error(`Arena Image鬯ｯ・ｯ繝ｻ・ｯ郢晢ｽｻ繝ｻ・ｯ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｯ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｩ鬯ｯ・ｮ繝ｻ・ｫ郢晢ｽｻ繝ｻ・ｰ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｳ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｾ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｵ鬯ｯ・ｯ繝ｻ・ｩ髯晢ｽｷ繝ｻ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・｢鬯ｮ・ｫ繝ｻ・ｴ鬮ｮ諛ｶ・ｽ・｣郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・｢鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｻ鬯ｯ・ｩ陝ｷ・｢繝ｻ・ｽ繝ｻ・｢鬮ｫ・ｴ髮懶ｽ｣繝ｻ・ｽ繝ｻ・｢驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｻ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｺ鬯ｯ・ｯ繝ｻ・ｯ郢晢ｽｻ繝ｻ・ｩ鬮ｯ譎｢・ｽ・ｷ郢晢ｽｻ繝ｻ・｢驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・｢鬯ｯ・ｮ繝ｻ・ｫ郢晢ｽｻ繝ｻ・ｴ鬯ｮ・ｮ隲幢ｽｶ繝ｻ・ｽ繝ｻ・｣驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・｢鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｻ鬯ｯ・ｯ繝ｻ・ｩ髯晢ｽｷ繝ｻ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・｢鬯ｮ・ｫ繝ｻ・ｴ鬮ｮ諛ｶ・ｽ・｣郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・｢鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｻ鬯ｯ・ｩ陝ｷ・｢繝ｻ・ｽ繝ｻ・｢鬮ｫ・ｴ髮懶ｽ｣繝ｻ・ｽ繝ｻ・｢驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｻ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｮ鬯ｯ・ｯ繝ｻ・ｯ郢晢ｽｻ繝ｻ・ｯ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｯ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｯ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｮ鬯ｯ・ｩ陝ｷ・｢繝ｻ・ｽ繝ｻ・｢鬮ｫ・ｴ髮懶ｽ｣繝ｻ・ｽ繝ｻ・｢驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｻ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｫ鬯ｯ・ｯ繝ｻ・ｩ髯晢ｽｷ繝ｻ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・｢鬯ｮ・ｫ繝ｻ・ｴ鬮ｮ諛ｶ・ｽ・｣郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・｢鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｻ鬯ｯ・ｩ陝ｷ・｢繝ｻ・ｽ繝ｻ・｢鬮ｫ・ｴ髮懶ｽ｣繝ｻ・ｽ繝ｻ・｢驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｻ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｱ鬯ｯ・ｯ繝ｻ・ｯ郢晢ｽｻ繝ｻ・ｩ鬮ｯ譎｢・ｽ・ｷ郢晢ｽｻ繝ｻ・｢驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・｢鬯ｯ・ｮ繝ｻ・ｫ郢晢ｽｻ繝ｻ・ｴ鬯ｮ・ｮ隲幢ｽｶ繝ｻ・ｽ繝ｻ・｣驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・｢鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｻ鬯ｯ・ｯ繝ｻ・ｩ髯晢ｽｷ繝ｻ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・｢鬯ｮ・ｫ繝ｻ・ｴ鬮ｮ諛ｶ・ｽ・｣郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・｢鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｻ鬯ｯ・ｩ陝ｷ・｢繝ｻ・ｽ繝ｻ・｢鬮ｫ・ｴ髮懶ｽ｣繝ｻ・ｽ繝ｻ・｢驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｻ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｭ鬯ｯ・ｯ繝ｻ・ｯ郢晢ｽｻ繝ｻ・ｯ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｯ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｩ鬯ｯ・ｮ繝ｻ・ｫ郢晢ｽｻ繝ｻ・ｰ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｳ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｾ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｵ鬯ｯ・ｯ繝ｻ・ｩ髯晢ｽｷ繝ｻ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・｢鬯ｮ・ｫ繝ｻ・ｴ鬮ｮ諛ｶ・ｽ・｣郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・｢鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｻ鬯ｯ・ｩ陝ｷ・｢繝ｻ・ｽ繝ｻ・｢鬮ｫ・ｴ髮懶ｽ｣繝ｻ・ｽ繝ｻ・｢驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｻ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｺ鬯ｯ・ｯ繝ｻ・ｯ郢晢ｽｻ繝ｻ・ｩ鬮ｯ譎｢・ｽ・ｷ郢晢ｽｻ繝ｻ・｢驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・｢鬯ｯ・ｮ繝ｻ・ｫ郢晢ｽｻ繝ｻ・ｴ鬯ｮ・ｮ隲幢ｽｶ繝ｻ・ｽ繝ｻ・｣驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・｢鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｻ鬯ｯ・ｯ繝ｻ・ｩ髯晢ｽｷ繝ｻ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・｢鬯ｮ・ｫ繝ｻ・ｴ鬮ｮ諛ｶ・ｽ・｣郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・｢鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｻ鬯ｯ・ｩ陝ｷ・｢繝ｻ・ｽ繝ｻ・｢鬮ｫ・ｴ髮懶ｽ｣繝ｻ・ｽ繝ｻ・｢驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｻ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｿ鬯ｯ・ｯ繝ｻ・ｯ郢晢ｽｻ繝ｻ・ｯ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｯ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｯ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｮ鬯ｯ・ｩ陝ｷ・｢繝ｻ・ｽ繝ｻ・｢鬮ｫ・ｴ髮懶ｽ｣繝ｻ・ｽ繝ｻ・｢驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｻ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｴ鬯ｯ・ｯ繝ｻ・ｯ郢晢ｽｻ繝ｻ・ｯ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｮ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｮ鬯ｯ・ｮ繝ｻ・ｫ郢晢ｽｻ繝ｻ・ｲ鬮ｯ譎｢・ｽ・ｷ郢晢ｽｻ繝ｻ・｢驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｶ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・｣鬯ｯ・ｯ繝ｻ・ｩ髯晢ｽｷ繝ｻ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・｢鬯ｮ・ｫ繝ｻ・ｴ鬮ｮ諛ｶ・ｽ・｣郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・｢鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｻ鬯ｯ・ｩ陝ｷ・｢繝ｻ・ｽ繝ｻ・｢鬮ｫ・ｴ髮懶ｽ｣繝ｻ・ｽ繝ｻ・｢驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｻ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ鬯ｯ・ｯ繝ｻ・ｩ髯晢ｽｷ繝ｻ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・｢鬯ｮ・ｫ繝ｻ・ｴ鬮ｮ諛ｶ・ｽ・｣郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・｢鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｻ鬯ｯ・ｩ陝ｷ・｢繝ｻ・ｽ繝ｻ・｢鬮ｫ・ｴ髮懶ｽ｣繝ｻ・ｽ繝ｻ・｢驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｻ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｼ鬯ｯ・ｯ繝ｻ・ｯ郢晢ｽｻ繝ｻ・ｯ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｯ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｩ鬯ｯ・ｮ繝ｻ・ｫ郢晢ｽｻ繝ｻ・ｰ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｳ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｾ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｵ鬯ｯ・ｯ繝ｻ・ｩ髯晢ｽｷ繝ｻ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・｢鬯ｮ・ｫ繝ｻ・ｴ鬮ｮ諛ｶ・ｽ・｣郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・｢鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｻ鬯ｯ・ｩ陝ｷ・｢繝ｻ・ｽ繝ｻ・｢鬮ｫ・ｴ髮懶ｽ｣繝ｻ・ｽ繝ｻ・｢驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｻ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｺ鬯ｯ・ｯ繝ｻ・ｯ郢晢ｽｻ繝ｻ・ｩ鬮ｯ譎｢・ｽ・ｷ郢晢ｽｻ繝ｻ・｢驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・｢鬯ｯ・ｮ繝ｻ・ｫ郢晢ｽｻ繝ｻ・ｴ鬯ｮ・ｮ隲幢ｽｶ繝ｻ・ｽ繝ｻ・｣驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・｢鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｻ鬯ｯ・ｯ繝ｻ・ｩ髯晢ｽｷ繝ｻ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・｢鬯ｮ・ｫ繝ｻ・ｴ鬮ｮ諛ｶ・ｽ・｣郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・｢鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｻ鬯ｯ・ｩ陝ｷ・｢繝ｻ・ｽ繝ｻ・｢鬮ｫ・ｴ髮懶ｽ｣繝ｻ・ｽ繝ｻ・｢驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｻ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｿ鬯ｯ・ｯ繝ｻ・ｯ郢晢ｽｻ繝ｻ・ｯ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｯ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｩ鬯ｯ・ｮ繝ｻ・ｫ郢晢ｽｻ繝ｻ・ｰ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｳ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｾ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｵ鬯ｯ・ｯ繝ｻ・ｩ髯晢ｽｷ繝ｻ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・｢鬯ｮ・ｫ繝ｻ・ｴ鬮ｮ諛ｶ・ｽ・｣郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・｢鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｻ鬯ｯ・ｩ陝ｷ・｢繝ｻ・ｽ繝ｻ・｢鬮ｫ・ｴ髮懶ｽ｣繝ｻ・ｽ繝ｻ・｢驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｻ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｺ鬯ｯ・ｯ繝ｻ・ｯ郢晢ｽｻ繝ｻ・ｩ鬮ｯ譎｢・ｽ・ｷ郢晢ｽｻ繝ｻ・｢驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・｢鬯ｯ・ｮ繝ｻ・ｫ郢晢ｽｻ繝ｻ・ｴ鬯ｮ・ｮ隲幢ｽｶ繝ｻ・ｽ繝ｻ・｣驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・｢鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｻ鬯ｯ・ｯ繝ｻ・ｩ髯晢ｽｷ繝ｻ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・｢鬯ｮ・ｫ繝ｻ・ｴ鬮ｮ諛ｶ・ｽ・｣郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・｢鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｻ鬯ｯ・ｩ陝ｷ・｢繝ｻ・ｽ繝ｻ・｢鬮ｫ・ｴ髮懶ｽ｣繝ｻ・ｽ繝ｻ・｢驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｻ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｫ鬯ｯ・ｯ繝ｻ・ｯ郢晢ｽｻ繝ｻ・ｯ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｯ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｮ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｯ鬯ｯ・ｯ繝ｻ・ｮ郢晢ｽｻ繝ｻ・ｫ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｶ鬯ｮ・ｴ鬮ｮ・｣繝ｻ・ｽ繝ｻ・｣鬮ｯ蜿･・ｸ蜷ｶ繝ｻ郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・･鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｻ鬯ｯ・ｯ繝ｻ・ｩ髯晢ｽｷ繝ｻ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・｢鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｧ鬯ｯ・ｮ繝ｻ・ｫ郢晢ｽｻ繝ｻ・ｰ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ鬩包ｽｶ闕ｵ證ｦ・ｽ・ｧ繝ｻ・ｭ驛｢譎｢・ｽ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ鬯ｯ・ｩ陝ｷ・｢繝ｻ・ｽ繝ｻ・｢鬮ｫ・ｴ髮懶ｽ｣繝ｻ・ｽ繝ｻ・｢驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｻ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ鬯ｯ・ｯ繝ｻ・ｩ髯晢ｽｷ繝ｻ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・｢鬯ｮ・ｫ繝ｻ・ｴ鬮ｮ諛ｶ・ｽ・｣郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・｢鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｻ鬯ｯ・ｩ陝ｷ・｢繝ｻ・ｽ繝ｻ・｢鬮ｫ・ｴ髮懶ｽ｣繝ｻ・ｽ繝ｻ・｢驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｻ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｱ鬯ｯ・ｯ繝ｻ・ｯ郢晢ｽｻ繝ｻ・ｯ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｯ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｮ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｫ鬯ｯ・ｩ陝ｷ・｢繝ｻ・ｽ繝ｻ・｢鬮ｫ・ｴ髮懶ｽ｣繝ｻ・ｽ繝ｻ・｢驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｻ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｰ鬯ｯ・ｯ繝ｻ・ｩ髯晢ｽｷ繝ｻ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・｢鬯ｮ・ｫ繝ｻ・ｴ鬮ｮ諛ｶ・ｽ・｣郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・｢鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｻ鬯ｯ・ｩ陝ｷ・｢繝ｻ・ｽ繝ｻ・｢鬮ｫ・ｴ髮懶ｽ｣繝ｻ・ｽ繝ｻ・｢驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｻ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｨ鬯ｯ・ｯ繝ｻ・ｯ郢晢ｽｻ繝ｻ・ｯ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｮ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｯ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｷ鬯ｯ・ｯ繝ｻ・ｮ郢晢ｽｻ繝ｻ・｣鬯ｮ・ｮ陷茨ｽｷ繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｨ鬯ｯ・ｮ繝ｻ・ｯ髫ｶ轣假ｽ･繝ｻ・ｽ・ｽ繝ｻ・ｻ驛｢・ｧ隰・∞・ｽ・ｽ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｲ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ鬯ｯ・ｩ陝ｷ・｢繝ｻ・ｽ繝ｻ・｢鬮ｫ・ｴ髮懶ｽ｣繝ｻ・ｽ繝ｻ・｢驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｻ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｱ鬯ｯ・ｯ繝ｻ・ｯ郢晢ｽｻ繝ｻ・ｩ鬮ｯ譎｢・ｽ・ｷ郢晢ｽｻ繝ｻ・｢驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・｢鬯ｯ・ｮ繝ｻ・ｫ郢晢ｽｻ繝ｻ・ｴ鬯ｮ・ｮ隲幢ｽｶ繝ｻ・ｽ繝ｻ・｣驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・｢鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｻ鬯ｯ・ｯ繝ｻ・ｩ髯晢ｽｷ繝ｻ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・｢鬯ｮ・ｫ繝ｻ・ｴ鬮ｮ諛ｶ・ｽ・｣郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・｢鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｻ鬯ｯ・ｩ陝ｷ・｢繝ｻ・ｽ繝ｻ・｢鬮ｫ・ｴ髮懶ｽ｣繝ｻ・ｽ繝ｻ・｢驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｻ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｰ鬯ｯ・ｯ繝ｻ・ｯ郢晢ｽｻ繝ｻ・ｯ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｯ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｩ鬯ｯ・ｮ繝ｻ・ｫ郢晢ｽｻ繝ｻ・ｰ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｳ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｾ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｵ鬯ｯ・ｯ繝ｻ・ｩ髯晢ｽｷ繝ｻ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・｢鬯ｮ・ｫ繝ｻ・ｴ鬮ｮ諛ｶ・ｽ・｣郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・｢鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｻ鬯ｯ・ｩ陝ｷ・｢繝ｻ・ｽ繝ｻ・｢鬮ｫ・ｴ髮懶ｽ｣繝ｻ・ｽ繝ｻ・｢驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｻ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｺ鬯ｯ・ｯ繝ｻ・ｯ郢晢ｽｻ繝ｻ・ｩ鬮ｯ譎｢・ｽ・ｷ郢晢ｽｻ繝ｻ・｢驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・｢鬯ｯ・ｮ繝ｻ・ｫ郢晢ｽｻ繝ｻ・ｴ鬯ｮ・ｮ隲幢ｽｶ繝ｻ・ｽ繝ｻ・｣驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・｢鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｻ鬯ｯ・ｯ繝ｻ・ｩ髯晢ｽｷ繝ｻ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・｢鬯ｮ・ｫ繝ｻ・ｴ鬮ｮ諛ｶ・ｽ・｣郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・｢鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｻ鬯ｯ・ｩ陝ｷ・｢繝ｻ・ｽ繝ｻ・｢鬮ｫ・ｴ髮懶ｽ｣繝ｻ・ｽ繝ｻ・｢驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｻ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｾ鬯ｯ・ｯ繝ｻ・ｯ郢晢ｽｻ繝ｻ・ｯ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｯ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｩ鬯ｯ・ｮ繝ｻ・ｫ郢晢ｽｻ繝ｻ・ｰ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｳ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｾ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｵ鬯ｯ・ｯ繝ｻ・ｩ髯晢ｽｷ繝ｻ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・｢鬯ｮ・ｫ繝ｻ・ｴ鬮ｮ諛ｶ・ｽ・｣郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・｢鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｻ鬯ｯ・ｩ陝ｷ・｢繝ｻ・ｽ繝ｻ・｢鬮ｫ・ｴ髮懶ｽ｣繝ｻ・ｽ繝ｻ・｢驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｻ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｺ鬯ｯ・ｯ繝ｻ・ｯ郢晢ｽｻ繝ｻ・ｯ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｮ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｯ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｷ鬯ｯ・ｯ繝ｻ・ｮ郢晢ｽｻ繝ｻ・｣鬯ｮ・ｮ陷茨ｽｷ繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｨ鬯ｯ・ｮ繝ｻ・ｯ髫ｶ轣假ｽ･繝ｻ・ｽ・ｽ繝ｻ・ｻ驛｢・ｧ隰・∞・ｽ・ｽ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｲ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ鬯ｯ・ｩ陝ｷ・｢繝ｻ・ｽ繝ｻ・｢鬮ｫ・ｴ髮懶ｽ｣繝ｻ・ｽ繝ｻ・｢驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｻ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｱ鬯ｯ・ｯ繝ｻ・ｯ郢晢ｽｻ繝ｻ・ｯ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｮ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｫ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｨ鬯ｯ・ｩ陝ｷ・｢繝ｻ・ｽ繝ｻ・｢鬮ｫ・ｴ髮懶ｽ｣繝ｻ・ｽ繝ｻ・｢驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｻ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｳ鬯ｯ・ｯ繝ｻ・ｯ郢晢ｽｻ繝ｻ・ｩ鬮ｯ譎｢・ｽ・ｷ郢晢ｽｻ繝ｻ・｢驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・｢鬯ｯ・ｮ繝ｻ・ｫ郢晢ｽｻ繝ｻ・ｴ鬯ｮ・ｮ隲幢ｽｶ繝ｻ・ｽ繝ｻ・｣驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・｢鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｻ鬯ｯ・ｯ繝ｻ・ｩ髯晢ｽｷ繝ｻ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・｢鬯ｮ・ｫ繝ｻ・ｴ鬮ｮ諛ｶ・ｽ・｣郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・｢鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｻ鬯ｯ・ｩ陝ｷ・｢繝ｻ・ｽ繝ｻ・｢鬮ｫ・ｴ髮懶ｽ｣繝ｻ・ｽ繝ｻ・｢驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｻ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｸ鬯ｯ・ｯ繝ｻ・ｩ髯晢ｽｷ繝ｻ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・｢鬯ｮ・ｫ繝ｻ・ｴ鬮ｮ諛ｶ・ｽ・｣郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・｢鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｻ鬯ｯ・ｩ陝ｷ・｢繝ｻ・ｽ繝ｻ・｢鬮ｫ・ｴ髮懶ｽ｣繝ｻ・ｽ繝ｻ・｢驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｻ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｲ鬯ｯ・ｯ繝ｻ・ｯ郢晢ｽｻ繝ｻ・ｯ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｩ鬯ｮ・ｯ隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｷ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・｢鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・｢鬯ｯ・ｯ繝ｻ・ｮ郢晢ｽｻ繝ｻ・ｫ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｴ鬯ｯ・ｮ繝ｻ・ｮ髫ｲ蟷｢・ｽ・ｶ郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・｣鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・｢鬯ｯ・ｩ陝ｷ・｢繝ｻ・ｽ繝ｻ・｢鬮ｫ・ｴ髮懶ｽ｣繝ｻ・ｽ繝ｻ・｢驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｻ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ鬯ｯ・ｩ陝ｷ・｢繝ｻ・ｽ繝ｻ・｢鬮ｫ・ｴ髮懶ｽ｣繝ｻ・ｽ繝ｻ・｢驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｻ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｻTTP ${response.status}`);
  const blob = await response.blob();
  return readRaster(new File([blob], "arena-image", { type: blob.type || "image/png" }));
}
function pxPerMeter(field: FieldGuide) {
  return field.mode === "circle" ? { x: field.radiusPx / field.radiusM, y: field.radiusPx / field.radiusM } : { x: field.widthPx / field.widthM, y: field.heightPx / field.heightM };
}
function fieldCenterPixels(field: FieldGuide) {
  return field.mode === "circle" ? { x: field.centerX, y: field.centerY } : { x: field.x + field.widthPx / 2, y: field.y + field.heightPx / 2 };
}
function metersToPixels(field: FieldGuide, xM: number, yM: number) {
  const c = fieldCenterPixels(field);
  const s = pxPerMeter(field);
  return { x: c.x + xM * s.x, y: c.y - yM * s.y };
}
function pixelsToMeters(field: FieldGuide, xPx: number, yPx: number) {
  const c = fieldCenterPixels(field);
  const s = pxPerMeter(field);
  return { x: (xPx - c.x) / s.x, y: (c.y - yPx) / s.y };
}
function metersToSizePixels(field: FieldGuide, widthM: number, heightM: number) {
  const s = pxPerMeter(field);
  return { width: widthM * s.x, height: heightM * s.y };
}
function meterRadiusPx(field: FieldGuide, meter: number) {
  const s = pxPerMeter(field);
  return (meter * (s.x + s.y)) / 2;
}
function moveItem<T>(items: T[], index: number, direction: -1 | 1) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= items.length) return items;
  const next = [...items];
  [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
  return next;
}
function reorderId(order: string[], id: string, direction: -1 | 1) {
  const index = order.indexOf(id);
  return index === -1 ? order : moveItem(order, index, direction);
}
function makeIcon(assetId: string): AppliedIcon {
  return { id: crypto.randomUUID(), assetId, visible: true };
}
function readStoredNumber(key: string, fallback: number) {
  const value = Number(localStorage.getItem(key));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
function fieldMarkerDataUrl(label: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><circle cx="64" cy="64" r="52" fill="#1b2638" stroke="#f6c85f" stroke-width="8"/><text x="64" y="78" text-anchor="middle" font-family="Arial,sans-serif" font-size="52" font-weight="800" fill="#ffffff">${label}</text></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}
function normalizeDiagramState(value: Partial<DiagramState>): DiagramState {
  const normalizeAsset = (asset: LibraryAsset) => ({ ...asset, category: asset.category === ("FieldMarker" as AssetCategory) ? "Field Markers" : asset.category });
  const importedAssets = (value.assets ?? []).filter((asset) => asset.source !== "default").map(normalizeAsset);
  const assets = [...defaultAssets, ...importedAssets];
  const objects = (value.objects ?? []).map((o) => ({ ...o, href: o.href ?? assets.find((a) => a.id === o.assetId)?.href ?? "", visible: o.visible ?? true, locked: o.locked ?? false, opacity: o.opacity ?? 1, rotation: o.rotation ?? 0, buffs: o.buffs ?? [], debuffs: o.debuffs ?? [] }));
  const imageObjects = (value.imageObjects ?? []).map((o) => ({ ...o, href: o.href ?? assets.find((a) => a.id === o.assetId)?.href ?? "", visible: o.visible ?? true, locked: o.locked ?? false, opacity: o.opacity ?? 1, rotation: o.rotation ?? 0, folderId: o.folderId ?? null, renderMode: o.renderMode ?? "image", arcAngleDeg: o.arcAngleDeg ?? 90 }));
  const aoes = (value.aoes ?? []).map((aoe) => ({ ...aoe, visible: aoe.visible ?? true, locked: aoe.locked ?? false }) as Aoe);
  const oldBackground = value.background ? { ...value.background, id: value.background.id ?? "background", visible: value.background.visible ?? true, locked: value.background.locked ?? false } : null;
  const backgrounds = (value.backgrounds?.length ? value.backgrounds : oldBackground ? [oldBackground] : []).map((bg) => ({ ...bg, id: bg.id ?? crypto.randomUUID(), visible: bg.visible ?? true, locked: bg.locked ?? false, opacity: bg.opacity ?? 0.65 }));
  const activeBackgroundId = value.activeBackgroundId && backgrounds.some((bg) => bg.id === value.activeBackgroundId) ? value.activeBackgroundId : backgrounds[0]?.id ?? null;
  const background = backgrounds.find((bg) => bg.id === activeBackgroundId) ?? null;
  const savedOrder = (value.layerOrder ?? []).filter((id) => id !== "field-guide" && id !== "background");
  const ids = [...aoes.map((a) => a.id), ...imageObjects.map((o) => o.id), ...objects.map((o) => o.id)];
  const layerOrder = [...savedOrder, ...ids.filter((id) => !savedOrder.includes(id))].filter((id) => ids.includes(id));
  const folders = (value.folders ?? []).map((folder) => ({ ...folder, itemIds: folder.itemIds.filter((id) => ids.includes(id)), expanded: folder.expanded ?? true, visible: folder.visible ?? true, locked: folder.locked ?? false })).filter((folder) => folder.itemIds.length > 0);
  return {
    ...initialState,
    ...value,
    background,
    backgrounds,
    activeBackgroundId,
    field: value.field ?? initialState.field,
    activeSceneId: value.activeSceneId ?? null,
    scenes: value.scenes ?? [],
    fieldGuideVisible: value.fieldGuideVisible ?? true,
    fieldGuideLocked: value.fieldGuideLocked ?? false,
    objects,
    imageObjects,
    aoes,
    assets,
    folders,
    layerOrder,
    snap: { grid: value.snap?.grid ?? true, gridVisible: value.snap?.gridVisible ?? true, gridSizeM: value.snap?.gridSizeM ?? 1, gridOpacity: value.snap?.gridOpacity ?? 0.55, minorColor: value.snap?.minorColor ?? "#89a6c7", majorColor: value.snap?.majorColor ?? "#d0e6ff" },
  };
}
function cloneData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
function sceneStateFromDiagram(value: DiagramState): SceneState {
  return cloneData({ background: value.background, backgrounds: value.backgrounds, activeBackgroundId: value.activeBackgroundId, field: value.field, fieldGuideVisible: value.fieldGuideVisible, fieldGuideLocked: value.fieldGuideLocked, objects: value.objects, imageObjects: value.imageObjects, aoes: value.aoes, folders: value.folders, layerOrder: value.layerOrder, snap: value.snap });
}
function saveActiveScene(value: DiagramState): DiagramState {
  if (!value.activeSceneId) return value;
  const state = sceneStateFromDiagram(value);
  return { ...value, scenes: value.scenes.map((scene) => scene.id === value.activeSceneId ? { ...scene, state } : scene) };
}
function downloadText(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
function fanPath(field: FieldGuide, aoe: FanAoe) {
  const c = metersToPixels(field, aoe.x, aoe.y);
  const r = meterRadiusPx(field, aoe.radiusM);
  const start = (aoe.directionDeg - aoe.angleDeg / 2) * (Math.PI / 180);
  const end = (aoe.directionDeg + aoe.angleDeg / 2) * (Math.PI / 180);
  const p1 = { x: c.x + Math.cos(start) * r, y: c.y - Math.sin(start) * r };
  const p2 = { x: c.x + Math.cos(end) * r, y: c.y - Math.sin(end) * r };
  return `M ${c.x} ${c.y} L ${p1.x} ${p1.y} A ${r} ${r} 0 ${aoe.angleDeg > 180 ? 1 : 0} 0 ${p2.x} ${p2.y} Z`;
}
function imageFanPath(field: FieldGuide, image: ImageObject) {
  const c = metersToPixels(field, image.x, image.y);
  const s = metersToSizePixels(field, image.widthM, image.heightM);
  const r = Math.max(s.width, s.height) / 2;
  const arc = Math.max(1, Math.min(image.arcAngleDeg ?? 90, 359.9));
  const direction = image.rotation;
  const start = (direction - arc / 2) * (Math.PI / 180);
  const end = (direction + arc / 2) * (Math.PI / 180);
  const p1 = { x: c.x + Math.cos(start) * r, y: c.y - Math.sin(start) * r };
  const p2 = { x: c.x + Math.cos(end) * r, y: c.y - Math.sin(end) * r };
  return `M ${c.x} ${c.y} L ${p1.x} ${p1.y} A ${r} ${r} 0 ${arc > 180 ? 1 : 0} 0 ${p2.x} ${p2.y} Z`;
}
function donutPath(field: FieldGuide, aoe: DonutAoe) {
  const c = metersToPixels(field, aoe.x, aoe.y);
  const outer = meterRadiusPx(field, Math.max(aoe.outerRadiusM, 0));
  const inner = meterRadiusPx(field, Math.max(Math.min(aoe.innerRadiusM, aoe.outerRadiusM), 0));
  return [
    `M ${c.x - outer} ${c.y}`,
    `A ${outer} ${outer} 0 1 0 ${c.x + outer} ${c.y}`,
    `A ${outer} ${outer} 0 1 0 ${c.x - outer} ${c.y}`,
    `M ${c.x - inner} ${c.y}`,
    `A ${inner} ${inner} 0 1 1 ${c.x + inner} ${c.y}`,
    `A ${inner} ${inner} 0 1 1 ${c.x - inner} ${c.y}`,
  ].join(" ");
}

function aoeLinePoints(field: FieldGuide, aoe: TetherAoe | ArrowAoe) {
  const c = metersToPixels(field, aoe.x, aoe.y);
  const length = meterRadiusPx(field, aoe.lengthM);
  const angle = aoe.directionDeg * (Math.PI / 180);
  const dx = Math.cos(angle) * length / 2;
  const dy = -Math.sin(angle) * length / 2;
  return { start: { x: c.x - dx, y: c.y - dy }, end: { x: c.x + dx, y: c.y + dy }, center: c };
}
function arrowGeometry(field: FieldGuide, aoe: ArrowAoe) {
  const line = aoeLinePoints(field, aoe);
  const width = Math.max(meterRadiusPx(field, aoe.strokeWidthM), 3);
  const headLength = Math.max(width * 6.4, 18);
  const headWidth = Math.max(width * 4.6, 14);
  const angle = aoe.directionDeg * (Math.PI / 180);
  const tip = { x: line.end.x + Math.cos(angle) * headLength * 0.25, y: line.end.y - Math.sin(angle) * headLength * 0.25 };
  const base = { x: tip.x - Math.cos(angle) * headLength, y: tip.y + Math.sin(angle) * headLength };
  const nx = -Math.sin(angle);
  const ny = -Math.cos(angle);
  return {
    start: line.start,
    shaftEnd: base,
    points: `${tip.x},${tip.y} ${base.x + nx * headWidth / 2},${base.y + ny * headWidth / 2} ${base.x - nx * headWidth / 2},${base.y - ny * headWidth / 2}`,
  };
}
function App() {
  const [diagram, setDiagram] = useState<DiagramState>(initialState);
  const [undoStack, setUndoStack] = useState<DiagramState[]>([]);
  const [redoStack, setRedoStack] = useState<DiagramState[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(null);
  const [importCategory, setImportCategory] = useState<AssetCategory>("Players");
  const [aoeKind, setAoeKind] = useState<Aoe["kind"]>("circle");
  const [aoeDraft, setAoeDraft] = useState({ label: "AoE", x: 0, y: 0, radiusM: 5, outerRadiusM: 8, innerRadiusM: 3, widthM: 4, heightM: 10, lengthM: 12, strokeWidthM: 0.35, rotation: 0, angleDeg: 90, directionDeg: 90, color: "#dc8030", opacity: 0.32 });
  const [zoom, setZoom] = useState(1);
  const [leftPanelWidth, setLeftPanelWidth] = useState(() => readStoredNumber("ff14-planner-left-panel", 360));
  const [rightPanelWidth, setRightPanelWidth] = useState(() => readStoredNumber("ff14-planner-right-panel", 440));
  const [leftCollapsed, setLeftCollapsed] = useState(() => localStorage.getItem("ff14-planner-left-collapsed") === "true");
  const [rightCollapsed, setRightCollapsed] = useState(() => localStorage.getItem("ff14-planner-right-collapsed") === "true");
  const [setupOpen, setSetupOpen] = useState(false);
  const [spaceDown, setSpaceDown] = useState(false);
  const [panMode, setPanMode] = useState(false);
  const [markerPresetRadius, setMarkerPresetRadius] = useState(18);
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>("idle");
  const [autoSaveMessage, setAutoSaveMessage] = useState("");
  const [autoSaveReady, setAutoSaveReady] = useState(false);
  const [arenaImageUrl, setArenaImageUrl] = useState("");
  const [arenaImageStatus, setArenaImageStatus] = useState("");
  const [availableArenaImages, setAvailableArenaImages] = useState<ArenaImageEntry[]>(arenaImages);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const canvasWrapRef = useRef<HTMLDivElement | null>(null);
  const spaceDownRef = useRef(false);
  const diagramRef = useRef(diagram);
  const autoSaveTimerRef = useRef<number | null>(null);
  const restorePromiseRef = useRef<Promise<AutoSaveEnvelope<DiagramState> | null> | null>(null);
  const restorePromptedRef = useRef(false);
  const confirmResolveRef = useRef<((confirmed: boolean) => void) | null>(null);
  useEffect(() => { diagramRef.current = diagram; }, [diagram]);
  useEffect(() => {
    let active = true;
    if (!restorePromiseRef.current) restorePromiseRef.current = loadAutoSave<DiagramState>();
    void restorePromiseRef.current
      .then((saved) => {
        if (!active) return;
        if (saved && !restorePromptedRef.current) {
          restorePromptedRef.current = true;
          setDiagram(normalizeDiagramState(saved.project));
          setAutoSaveStatus("saved");
          setAutoSaveMessage(`Auto restored ${new Date(saved.updatedAt).toLocaleString()}`);
        }
      })
      .catch((error) => {
        if (active) {
          setAutoSaveStatus("error");
          setAutoSaveMessage(error instanceof Error ? error.message : "Auto Save restore failed.");
        }
      })
      .finally(() => {
        if (active) setAutoSaveReady(true);
      });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!autoSaveReady) return;
    setAutoSaveStatus("dirty");
    if (autoSaveTimerRef.current) window.clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = window.setTimeout(() => {
      setAutoSaveStatus("saving");
      void saveAutoSave(saveActiveScene(diagramRef.current))
        .then((envelope) => {
          setAutoSaveStatus("saved");
          setAutoSaveMessage(`Saved ${new Date(envelope.updatedAt).toLocaleTimeString()}`);
        })
        .catch((error) => {
          setAutoSaveStatus("error");
          setAutoSaveMessage(error instanceof Error ? error.message : "Auto Save failed.");
        });
    }, 600);
    return () => {
      if (autoSaveTimerRef.current) window.clearTimeout(autoSaveTimerRef.current);
    };
  }, [diagram, autoSaveReady]);
  useEffect(() => { localStorage.setItem("ff14-planner-left-panel", String(leftPanelWidth)); }, [leftPanelWidth]);
  useEffect(() => { localStorage.setItem("ff14-planner-right-panel", String(rightPanelWidth)); }, [rightPanelWidth]);
  useEffect(() => { localStorage.setItem("ff14-planner-left-collapsed", String(leftCollapsed)); }, [leftCollapsed]);
  useEffect(() => { localStorage.setItem("ff14-planner-right-collapsed", String(rightCollapsed)); }, [rightCollapsed]);
  useEffect(() => {
    let active = true;
    setArenaImageStatus("");
    void loadArenaImagesFromGitHub()
      .then((images) => {
        if (!active) return;
        setAvailableArenaImages(images);
        setArenaImageStatus("");
      })
      .catch(() => {
        if (!active) return;
        setAvailableArenaImages(arenaImages);
        setArenaImageStatus("");
      });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      e.preventDefault();
      if (document.activeElement instanceof HTMLSelectElement) document.activeElement.blur();
      spaceDownRef.current = true;
      setSpaceDown(true);
    };
    const up = (e: KeyboardEvent) => { if (e.code === "Space") { spaceDownRef.current = false; setSpaceDown(false); } };
    window.addEventListener("keydown", down, { capture: true });
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down, { capture: true }); window.removeEventListener("keyup", up); };
  }, []);

  const scale = pxPerMeter(diagram.field);
  const requestConfirm = (dialog: ConfirmDialog) => new Promise<boolean>((resolve) => {
    confirmResolveRef.current = resolve;
    setConfirmDialog(dialog);
  });
  const closeConfirm = (confirmed: boolean) => {
    confirmResolveRef.current?.(confirmed);
    confirmResolveRef.current = null;
    setConfirmDialog(null);
  };
  const selectedObject = diagram.objects.find((x) => x.id === selectedId);
  const selectedImage = diagram.imageObjects.find((x) => x.id === selectedId);
  const selectedAoe = diagram.aoes.find((x) => x.id === selectedId);
  const selectedLocked = selectedObject?.locked || selectedImage?.locked || selectedAoe?.locked || false;

  const commit = (updater: (current: DiagramState) => DiagramState) => setDiagram((current) => { const next = normalizeDiagramState(updater(current)); setUndoStack((s) => [...s.slice(-49), current]); setRedoStack([]); return next; });
  const applyWithoutHistory = (updater: (current: DiagramState) => DiagramState) => setDiagram((current) => normalizeDiagramState(updater(current)));
  const pushUndoSnapshot = (before: DiagramState) => { setUndoStack((s) => [...s.slice(-49), before]); setRedoStack([]); };
  const undo = () => setUndoStack((s) => { const prev = s.at(-1); if (!prev) return s; setRedoStack((r) => [...r, diagramRef.current]); setDiagram(prev); setSelectedId(null); return s.slice(0, -1); });
  const redo = () => setRedoStack((s) => { const next = s.at(-1); if (!next) return s; setUndoStack((u) => [...u, diagramRef.current]); setDiagram(next); setSelectedId(null); return s.slice(0, -1); });
  const updateField = (patch: Partial<FieldGuide>) => commit((c) => ({ ...c, field: { ...c.field, ...patch } as FieldGuide }));
  const updateBackground = (patch: Partial<BackgroundImage>) => commit((c) => {
    if (!c.background) return c;
    const background = { ...c.background, ...patch };
    return { ...c, background, backgrounds: c.backgrounds.map((bg) => bg.id === background.id ? background : bg) };
  });
  const makeBackground = (name: string, img: { href: string; width: number; height: number }, sourceUrl?: string): BackgroundImage => {
    const scale = Math.min(canvasSize.width / img.width, canvasSize.height / img.height, 1);
    return { id: crypto.randomUUID(), name, href: img.href, sourceUrl, naturalWidth: img.width, naturalHeight: img.height, width: img.width * scale, height: img.height * scale, x: (canvasSize.width - img.width * scale) / 2, y: (canvasSize.height - img.height * scale) / 2, opacity: 0.65, visible: true, locked: false };
  };
  const addBackgrounds = (backgrounds: BackgroundImage[]) => commit((c) => ({ ...c, backgrounds: [...c.backgrounds, ...backgrounds], background: backgrounds[backgrounds.length - 1] ?? c.background, activeBackgroundId: backgrounds[backgrounds.length - 1]?.id ?? c.activeBackgroundId }));
  const loadArenaImage = async (url: string) => {
    const entry = availableArenaImages.find((image) => image.url === url);
    if (!entry) return;
    setArenaImageStatus("Loading Arena Image...");
    try {
      const img = await readRasterUrl(entry.url);
      addBackgrounds([makeBackground(entry.name, img, entry.url)]);
      setArenaImageStatus("");
    } catch (error) {
      setArenaImageStatus(error instanceof Error ? error.message : "Arena Image could not be loaded.");
    }
  };
  const setActiveBackground = (id: string) => commit((c) => {
    const background = c.backgrounds.find((bg) => bg.id === id) ?? null;
    return { ...c, background, activeBackgroundId: background?.id ?? null };
  });
  const removeActiveBackground = () => commit((c) => {
    if (!c.background) return c;
    const backgrounds = c.backgrounds.filter((bg) => bg.id !== c.background?.id);
    const background = backgrounds[0] ?? null;
    return { ...c, backgrounds, background, activeBackgroundId: background?.id ?? null };
  });
  const updateObject = (id: string, patch: Partial<CombatObject>) => commit((c) => ({ ...c, objects: c.objects.map((x) => x.id === id ? { ...x, ...patch } : x) }));
  const updateImageObject = (id: string, patch: Partial<ImageObject>) => commit((c) => ({ ...c, imageObjects: c.imageObjects.map((x) => x.id === id ? { ...x, ...patch } : x) }));
  const updateAoe = (id: string, patch: Partial<Aoe>) => commit((c) => ({ ...c, aoes: c.aoes.map((x) => x.id === id ? { ...x, ...patch } as Aoe : x) }));
  const setSnap = (patch: Partial<DiagramState["snap"]>) => commit((c) => ({ ...c, snap: { ...c.snap, ...patch } }));
  const deleteId = (id: string) => {
    const locked = [...diagram.objects, ...diagram.imageObjects, ...diagram.aoes].find((x) => x.id === id)?.locked;
    if (locked || id === "field-guide") return;
    commit((c) => ({ ...c, objects: c.objects.filter((x) => x.id !== id), imageObjects: c.imageObjects.filter((x) => x.id !== id), aoes: c.aoes.filter((x) => x.id !== id), folders: c.folders.map((f) => ({ ...f, itemIds: f.itemIds.filter((itemId) => itemId !== id) })).filter((f) => f.itemIds.length > 0), layerOrder: c.layerOrder.filter((x) => x !== id) }));
    if (selectedId === id) setSelectedId(null);
  };
  const moveLayer = (id: string, direction: -1 | 1) => commit((c) => ({ ...c, layerOrder: reorderId(c.layerOrder, id, direction) }));
  const createFolderFromSelection = () => selectedId && commit((c) => {
    if (selectedId === "background" || selectedId === "field-guide") return c;
    const id = crypto.randomUUID();
    const label = "Layer folder";
    return { ...c, folders: [{ id, label, itemIds: [selectedId], expanded: true, visible: true, locked: false }, ...c.folders], imageObjects: c.imageObjects.map((o) => o.id === selectedId ? { ...o, folderId: id } : o) };
  });
  const moveSelectedToFolder = (folderId: string) => selectedId && commit((c) => {
    if (selectedId === "background" || selectedId === "field-guide") return c;
    return { ...c, folders: c.folders.map((folder) => ({ ...folder, expanded: folder.id === folderId ? true : folder.expanded, itemIds: folder.id === folderId ? [...folder.itemIds.filter((id) => id !== selectedId), selectedId] : folder.itemIds.filter((id) => id !== selectedId) })).filter((folder) => folder.itemIds.length > 0), imageObjects: c.imageObjects.map((o) => o.id === selectedId ? { ...o, folderId } : o) };
  });
  const removeSelectedFromFolder = () => selectedId && commit((c) => ({ ...c, folders: c.folders.map((folder) => ({ ...folder, itemIds: folder.itemIds.filter((id) => id !== selectedId) })).filter((folder) => folder.itemIds.length > 0), imageObjects: c.imageObjects.map((o) => o.id === selectedId ? { ...o, folderId: null } : o) }));
  const updateFolder = (id: string, patch: Partial<LayerFolder>) => commit((c) => {
    const folder = c.folders.find((f) => f.id === id);
    if (!folder) return c;
    const folders = c.folders.map((f) => f.id === id ? { ...f, ...patch } : f);
    const visiblePatch = patch.visible === undefined ? {} : { visible: patch.visible };
    const lockedPatch = patch.locked === undefined ? {} : { locked: patch.locked };
    return { ...c, folders, imageObjects: c.imageObjects.map((o) => folder.itemIds.includes(o.id) ? { ...o, ...visiblePatch, ...lockedPatch } : o), objects: c.objects.map((o) => folder.itemIds.includes(o.id) ? { ...o, ...visiblePatch, ...lockedPatch } : o), aoes: c.aoes.map((a) => folder.itemIds.includes(a.id) ? { ...a, ...visiblePatch, ...lockedPatch } as Aoe : a) };
  });
  const startPanelResize = (side: "left" | "right", event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = side === "left" ? leftPanelWidth : rightPanelWidth;
    const move = (e: PointerEvent) => {
      const delta = e.clientX - startX;
      const next = side === "left" ? startWidth + delta : startWidth - delta;
      if (side === "left") setLeftPanelWidth(clamp(next, 280, 560));
      else setRightPanelWidth(clamp(next, 320, 620));
    };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const handleCanvasPanPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const shouldPan = event.button === 1 || event.button === 2 || (event.button === 0 && (spaceDownRef.current || panMode));
    if (!shouldPan || !canvasWrapRef.current) return;
    event.preventDefault();
    const wrap = canvasWrapRef.current;
    const start = { x: event.clientX, y: event.clientY, left: wrap.scrollLeft, top: wrap.scrollTop };
    wrap.classList.add("panning");
    const move = (e: PointerEvent) => { wrap.scrollLeft = start.left - (e.clientX - start.x); wrap.scrollTop = start.top - (e.clientY - start.y); };
    const up = () => { wrap.classList.remove("panning"); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const gridLines = useMemo(() => {
    const lines: { id: string; x1: number; y1: number; x2: number; y2: number; major: boolean }[] = [];
    for (let v = -80; v <= 80; v += Math.max(diagram.snap.gridSizeM, 0.25)) {
      const top = metersToPixels(diagram.field, v, -80);
      const bottom = metersToPixels(diagram.field, v, 80);
      const left = metersToPixels(diagram.field, -80, v);
      const right = metersToPixels(diagram.field, 80, v);
      const major = Math.abs(v % 5) < 0.001;
      lines.push({ id: `v-${v}`, x1: top.x, y1: top.y, x2: bottom.x, y2: bottom.y, major }, { id: `h-${v}`, x1: left.x, y1: left.y, x2: right.x, y2: right.y, major });
    }
    return lines;
  }, [diagram.field, diagram.snap.gridSizeM]);

  const addAssetToCanvas = (asset: LibraryAsset, x = 0, y = 0) => commit((c) => {
    const id = crypto.randomUUID();
    if (asset.category === "Players" || asset.category === "Boss") {
      const obj: CombatObject = { id, kind: asset.category === "Players" ? "player" : "boss", label: asset.name, assetId: asset.id, href: asset.href, x, y, widthM: asset.category === "Players" ? 2 : 5, heightM: asset.category === "Players" ? 2 : 5, rotation: 0, opacity: 1, visible: true, locked: false, buffs: [], debuffs: [] };
      return { ...c, objects: [...c.objects, obj], layerOrder: [id, ...c.layerOrder] };
    }
    const isFanImageAoe = asset.id === "default-aoe-fan-aoe" || asset.tags.includes("fan");
    const size = asset.category === "AoE" ? 10 : 3;
    const image: ImageObject = { id, label: asset.name, assetId: asset.id, href: asset.href, x, y, widthM: size, heightM: size, rotation: isFanImageAoe ? 90 : 0, opacity: 1, visible: true, locked: false, renderMode: isFanImageAoe ? "fan" : "image", arcAngleDeg: isFanImageAoe ? 90 : 90 };
    return { ...c, imageObjects: [...c.imageObjects, image], layerOrder: [id, ...c.layerOrder] };
  });
  const addAoe = () => {
    const id = crypto.randomUUID();
    const base = { id, label: aoeDraft.label, x: aoeDraft.x, y: aoeDraft.y, color: aoeDraft.color, opacity: aoeKind === "tether" || aoeKind === "arrow" ? 1 : aoeDraft.opacity, visible: true, locked: false };
    const aoe: Aoe = aoeKind === "circle" ? { ...base, kind: "circle", radiusM: aoeDraft.radiusM } : aoeKind === "rect" ? { ...base, kind: "rect", widthM: aoeDraft.widthM, heightM: aoeDraft.heightM, rotation: aoeDraft.rotation } : aoeKind === "fan" ? { ...base, kind: "fan", radiusM: aoeDraft.radiusM, angleDeg: aoeDraft.angleDeg, directionDeg: aoeDraft.directionDeg } : aoeKind === "donut" ? { ...base, kind: "donut", outerRadiusM: aoeDraft.outerRadiusM, innerRadiusM: aoeDraft.innerRadiusM } : aoeKind === "tether" ? { ...base, kind: "tether", lengthM: aoeDraft.lengthM, strokeWidthM: aoeDraft.strokeWidthM, directionDeg: aoeDraft.directionDeg } : { ...base, kind: "arrow", lengthM: aoeDraft.lengthM, strokeWidthM: aoeDraft.strokeWidthM, directionDeg: aoeDraft.directionDeg };
    commit((c) => ({ ...c, aoes: [...c.aoes, aoe], layerOrder: [id, ...c.layerOrder] }));
  };
  const addPlayerIcon = (type: "buffs" | "debuffs", assetId: string) => selectedObject?.kind === "player" && updateObject(selectedObject.id, { [type]: [...selectedObject[type], { id: crypto.randomUUID(), assetId, visible: true }] } as Partial<CombatObject>);
  const updatePlayerIconList = (type: "buffs" | "debuffs", next: AppliedIcon[]) => selectedObject?.kind === "player" && updateObject(selectedObject.id, { [type]: next } as Partial<CombatObject>);
  const addFieldMarkerPreset = (pattern: "A" | "B") => commit((c) => {
    const labels = pattern === "A" ? ["A", "2", "B", "3", "C", "4", "D", "1"] : ["A", "1", "B", "2", "C", "3", "D", "4"];
    const assets = [...c.assets];
    const imageObjects = [...c.imageObjects];
    const order: string[] = [];
    const folderId = crypto.randomUUID();
    labels.forEach((label, index) => {
      let asset = assets.find((a) => a.category === "Field Markers" && (a.name.toLowerCase() === label.toLowerCase() || a.name.toLowerCase() === `waymark ${label.toLowerCase()}`));
      if (!asset) {
        asset = { id: `preset-field-marker-${label}`, name: label, category: "Field Markers", href: fieldMarkerDataUrl(label), tags: ["field-marker"], source: "import" };
        assets.push(asset);
      }
      const angle = (90 - index * 45) * (Math.PI / 180);
      const id = crypto.randomUUID();
      imageObjects.push({ id, label, assetId: asset.id, href: asset.href, x: Math.cos(angle) * markerPresetRadius, y: Math.sin(angle) * markerPresetRadius, widthM: 2.8, heightM: 2.8, rotation: 0, opacity: 1, visible: true, locked: false, folderId, renderMode: "image", arcAngleDeg: 90 });
      order.push(id);
    });
    const folder: LayerFolder = { id: folderId, label: `Field Markers ${pattern}`, itemIds: order, expanded: true, visible: true, locked: false };
    return { ...c, assets, imageObjects, folders: [folder, ...c.folders], layerOrder: [...order, ...c.layerOrder] };
  });

  const handleObjectPointerDown = (event: React.PointerEvent<SVGElement>, id: string) => {
    if (event.button !== 0 || spaceDownRef.current || panMode) return;
    const locked = [...diagram.objects, ...diagram.imageObjects, ...diagram.aoes].find((x) => x.id === id)?.locked;
    if (locked) { setSelectedId(id); return; }
    event.preventDefault(); setSelectedId(id);
    const before = diagramRef.current; let changed = false;
    const move = (e: PointerEvent) => {
      const svg = svgRef.current; const t = svg?.getScreenCTM(); if (!svg || !t) return;
      const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
      const world = pixelsToMeters(diagram.field, p.matrixTransform(t.inverse()).x, p.matrixTransform(t.inverse()).y);
      const x = diagram.snap.grid ? Math.round(world.x / diagram.snap.gridSizeM) * diagram.snap.gridSizeM : world.x;
      const y = diagram.snap.grid ? Math.round(world.y / diagram.snap.gridSizeM) * diagram.snap.gridSizeM : world.y;
      changed = true;
      applyWithoutHistory((c) => ({ ...c, objects: c.objects.map((o) => o.id === id ? { ...o, x, y } : o), imageObjects: c.imageObjects.map((o) => o.id === id ? { ...o, x, y } : o), aoes: c.aoes.map((a) => a.id === id ? { ...a, x, y } as Aoe : a) }));
    };
    const up = () => { if (changed) pushUndoSnapshot(before); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };
  const handleGuidePointerDown = (event: React.PointerEvent<SVGElement>) => {
    if (event.button !== 0 || spaceDownRef.current || panMode) return;
    if (diagram.fieldGuideLocked) return; event.preventDefault(); setSelectedId(null);
    const before = diagramRef.current; let changed = false;
    const move = (e: PointerEvent) => {
      const svg = svgRef.current; const t = svg?.getScreenCTM(); if (!svg || !t) return;
      const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; const sp = p.matrixTransform(t.inverse());
      changed = true;
      applyWithoutHistory((c) => c.field.mode === "circle" ? { ...c, field: { ...c.field, centerX: sp.x, centerY: sp.y } } : { ...c, field: { ...c.field, x: sp.x - c.field.widthPx / 2, y: sp.y - c.field.heightPx / 2 } });
    };
    const up = () => { if (changed) pushUndoSnapshot(before); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };
  const handleBackgroundPointerDown = (event: React.PointerEvent<SVGImageElement>) => {
    if (event.button !== 0 || spaceDownRef.current || panMode) return;
    if (!diagram.background || diagram.background.locked) return;
    event.preventDefault();
    const svg = svgRef.current; const t = svg?.getScreenCTM(); if (!svg || !t) return;
    const p = svg.createSVGPoint(); p.x = event.clientX; p.y = event.clientY; const start = p.matrixTransform(t.inverse());
    const original = diagram.background; const before = diagramRef.current; let changed = false;
    const move = (e: PointerEvent) => { const ct = svg.getScreenCTM(); if (!ct) return; const mp = svg.createSVGPoint(); mp.x = e.clientX; mp.y = e.clientY; const now = mp.matrixTransform(ct.inverse()); changed = true; applyWithoutHistory((c) => ({ ...c, background: c.background ? { ...c.background, x: original.x + now.x - start.x, y: original.y + now.y - start.y } : null })); };
    const up = () => { if (changed) pushUndoSnapshot(before); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };
  const handleCanvasDrop = (event: React.DragEvent<SVGSVGElement>) => {
    event.preventDefault(); const asset = diagram.assets.find((a) => a.id === event.dataTransfer.getData("text/asset-id"));
    const svg = svgRef.current; const t = svg?.getScreenCTM(); if (!asset || !svg || !t) return;
    const p = svg.createSVGPoint(); p.x = event.clientX; p.y = event.clientY; const sp = p.matrixTransform(t.inverse()); const world = pixelsToMeters(diagram.field, sp.x, sp.y);
    addAssetToCanvas(asset, world.x, world.y);
  };
  const exportPng = () => {
    const svg = svgRef.current; if (!svg) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.querySelectorAll("[data-export-ignore]").forEach((node) => node.remove());
    clone.removeAttribute("style");
    clone.setAttribute("width", String(canvasSize.width));
    clone.setAttribute("height", String(canvasSize.height));
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml;charset=utf-8" }));
    const image = new Image(); image.onload = () => { const c = document.createElement("canvas"); c.width = canvasSize.width; c.height = canvasSize.height; const ctx = c.getContext("2d"); if (!ctx) return; ctx.fillStyle = "#10151f"; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(image, 0, 0); URL.revokeObjectURL(url); const a = document.createElement("a"); a.href = c.toDataURL("image/png"); a.download = "ff14-diagram.png"; a.click(); }; image.src = url;
  };
  const exportJson = () => downloadText("ff14-diagram.json", JSON.stringify(saveActiveScene(diagram), null, 2), "application/json");
  const importJson = async (file: File) => {
    try {
      if (await hasAutoSave() && !(await requestConfirm({ title: "Load JSON", message: "Load this JSON and replace the current project?", confirmLabel: "Load", cancelLabel: "Cancel" }))) return;
    } catch {
      // Broken auto save data should not block JSON restore.
    }
    setUndoStack((s) => [...s.slice(-49), diagram]);
    setRedoStack([]);
    setDiagram(normalizeDiagramState(JSON.parse(await file.text()) as Partial<DiagramState>));
    setSelectedId(null);
    setAutoSaveStatus("dirty");
  };
  const resetToBlankProject = async () => {
    if (!(await requestConfirm({ title: "Reset Blank", message: "Reset the current project and clear auto save?", confirmLabel: "Reset", cancelLabel: "Cancel" }))) return;
    try {
      await clearAutoSave();
      setUndoStack((s) => [...s.slice(-49), diagram]);
      setRedoStack([]);
      setSelectedId(null);
      setDiagram(initialState);
      setAutoSaveStatus("dirty");
      setAutoSaveMessage("Reset to blank project");
    } catch (error) {
      setAutoSaveStatus("error");
      setAutoSaveMessage(error instanceof Error ? error.message : "Reset failed.");
    }
  };
  const createSceneFromCurrent = () => commit((c) => {
    const saved = saveActiveScene(c);
    const id = crypto.randomUUID();
    const scene: SceneSnapshot = { id, name: `Scene ${saved.scenes.length + 1}`, notes: "", state: sceneStateFromDiagram(saved) };
    return { ...saved, activeSceneId: id, scenes: [...saved.scenes, scene] };
  });
  const createBlankScene = () => commit((c) => {
    const saved = saveActiveScene(c);
    const id = crypto.randomUUID();
    const scene: SceneSnapshot = { id, name: `Scene ${saved.scenes.length + 1}`, notes: "", state: sceneStateFromDiagram({ ...initialState, assets: saved.assets, scenes: saved.scenes, activeSceneId: id }) };
    return normalizeDiagramState({ ...saved, ...scene.state, activeSceneId: id, scenes: [...saved.scenes, scene] });
  });
  const switchScene = (id: string) => commit((c) => {
    const saved = saveActiveScene(c);
    const scene = saved.scenes.find((s) => s.id === id);
    return scene ? normalizeDiagramState({ ...saved, ...scene.state, activeSceneId: id, scenes: saved.scenes }) : saved;
  });
  const updateScene = (id: string, patch: Partial<Omit<SceneSnapshot, "id" | "state">>) => commit((c) => ({ ...c, scenes: c.scenes.map((scene) => scene.id === id ? { ...scene, ...patch } : scene) }));
  const duplicateScene = (id: string) => commit((c) => {
    const saved = saveActiveScene(c);
    const source = saved.scenes.find((scene) => scene.id === id);
    if (!source) return saved;
    const nextId = crypto.randomUUID();
    const nextScene = { ...cloneData(source), id: nextId, name: `${source.name} copy` };
    return normalizeDiagramState({ ...saved, ...nextScene.state, activeSceneId: nextId, scenes: [...saved.scenes, nextScene] });
  });
  const deleteScene = (id: string) => commit((c) => {
    const scenes = c.scenes.filter((scene) => scene.id !== id);
    if (c.activeSceneId !== id) return { ...c, scenes };
    const next = scenes[0];
    return next ? normalizeDiagramState({ ...c, ...next.state, activeSceneId: next.id, scenes }) : { ...c, activeSceneId: null, scenes };
  });

  const layers = diagram.layerOrder.map((id) => ({ id, object: diagram.objects.find((x) => x.id === id), image: diagram.imageObjects.find((x) => x.id === id), aoe: diagram.aoes.find((x) => x.id === id) })).filter((x) => x.object || x.image || x.aoe);
  const folderItemIds = new Set(diagram.folders.flatMap((folder) => folder.itemIds));
  const selectedFolder = selectedId ? diagram.folders.find((folder) => folder.itemIds.includes(selectedId)) : undefined;
  const iconAssets = diagram.assets.filter((a) => a.source === "import" && (a.category === "Buffs" || a.category === "Debuffs"));

  const renderLayer = (id: string) => {
    const aoe = diagram.aoes.find((a) => a.id === id); if (aoe?.visible) { const p = metersToPixels(diagram.field, aoe.x, aoe.y); if (aoe.kind === "circle") return <g key={id} onPointerDown={(e) => handleObjectPointerDown(e, id)} className={aoe.locked ? "locked-background" : "draggable"}><circle cx={p.x} cy={p.y} r={meterRadiusPx(diagram.field, aoe.radiusM)} fill={aoe.color} opacity={aoe.opacity} stroke={aoe.color} strokeWidth="3" /></g>; if (aoe.kind === "rect") { const s = metersToSizePixels(diagram.field, aoe.widthM, aoe.heightM); return <g key={id} onPointerDown={(e) => handleObjectPointerDown(e, id)} className={aoe.locked ? "locked-background" : "draggable"} transform={`rotate(${-aoe.rotation} ${p.x} ${p.y})`}><rect x={p.x - s.width / 2} y={p.y - s.height / 2} width={s.width} height={s.height} fill={aoe.color} opacity={aoe.opacity} stroke={aoe.color} strokeWidth="3" /></g>; } if (aoe.kind === "donut") return <g key={id} onPointerDown={(e) => handleObjectPointerDown(e, id)} className={aoe.locked ? "locked-background" : "draggable"}><path d={donutPath(diagram.field, aoe)} fill={aoe.color} fillRule="evenodd" opacity={aoe.opacity} stroke={aoe.color} strokeWidth="3" /></g>; if (aoe.kind === "tether") { const line = aoeLinePoints(diagram.field, aoe); return <g key={id} onPointerDown={(e) => handleObjectPointerDown(e, id)} className={aoe.locked ? "locked-background" : "draggable"}><line x1={line.start.x} y1={line.start.y} x2={line.end.x} y2={line.end.y} stroke={aoe.color} strokeWidth={Math.max(meterRadiusPx(diagram.field, aoe.strokeWidthM), 2)} strokeLinecap="round" opacity={aoe.opacity} /></g>; } if (aoe.kind === "arrow") { const arrow = arrowGeometry(diagram.field, aoe); return <g key={id} onPointerDown={(e) => handleObjectPointerDown(e, id)} className={aoe.locked ? "locked-background" : "draggable"}><line x1={arrow.start.x} y1={arrow.start.y} x2={arrow.shaftEnd.x} y2={arrow.shaftEnd.y} stroke={aoe.color} strokeWidth={Math.max(meterRadiusPx(diagram.field, aoe.strokeWidthM), 2)} strokeLinecap="round" opacity={aoe.opacity} /><polygon points={arrow.points} fill={aoe.color} opacity={aoe.opacity} /></g>; } return <g key={id} onPointerDown={(e) => handleObjectPointerDown(e, id)} className={aoe.locked ? "locked-background" : "draggable"}><path d={fanPath(diagram.field, aoe)} fill={aoe.color} opacity={aoe.opacity} stroke={aoe.color} strokeWidth="3" /></g>; }
    const image = diagram.imageObjects.find((o) => o.id === id); if (image?.visible) { const p = metersToPixels(diagram.field, image.x, image.y); const s = metersToSizePixels(diagram.field, image.widthM, image.heightM); if (image.renderMode === "fan") { const clipId = `clip-${image.id}`; return <g key={id} onPointerDown={(e) => handleObjectPointerDown(e, id)} className={image.locked ? "locked-background" : "draggable"}><defs><clipPath id={clipId}><path d={imageFanPath(diagram.field, image)} /></clipPath></defs><image href={image.href} x={p.x - s.width / 2} y={p.y - s.height / 2} width={s.width} height={s.height} opacity={image.opacity} preserveAspectRatio="none" clipPath={`url(#${clipId})`} /></g>; } return <image key={id} href={image.href} x={p.x - s.width / 2} y={p.y - s.height / 2} width={s.width} height={s.height} opacity={image.opacity} preserveAspectRatio="none" transform={`rotate(${-image.rotation} ${p.x} ${p.y})`} onPointerDown={(e) => handleObjectPointerDown(e, id)} className={image.locked ? "locked-background" : "draggable"} />; }
    const object = diagram.objects.find((o) => o.id === id); if (object?.visible) { const p = metersToPixels(diagram.field, object.x, object.y); const s = metersToSizePixels(diagram.field, object.widthM, object.heightM); const icon = Math.max(18, Math.min(s.width, s.height) * 0.32); return <g key={id} onPointerDown={(e) => handleObjectPointerDown(e, id)} className={object.locked ? "locked-background" : "draggable"}><image href={object.href} x={p.x - s.width / 2} y={p.y - s.height / 2} width={s.width} height={s.height} opacity={object.opacity} preserveAspectRatio="none" transform={`rotate(${-object.rotation} ${p.x} ${p.y})`} />{object.buffs.filter((x) => x.visible).map((x, i) => { const a = diagram.assets.find((asset) => asset.id === x.assetId); return a ? <image key={x.id} href={a.href} x={p.x + s.width / 2 - icon / 2 + i * icon * 0.72} y={p.y - s.height / 2 - icon * 0.45} width={icon} height={icon} /> : null; })}{object.debuffs.filter((x) => x.visible).map((x, i) => { const a = diagram.assets.find((asset) => asset.id === x.assetId); return a ? <image key={x.id} href={a.href} x={p.x + s.width / 2 - icon / 2 + i * icon * 0.72} y={p.y - s.height / 2 + icon * 0.45} width={icon} height={icon} /> : null; })}</g>; }
    return null;
  };
  const renderFieldGuide = () => diagram.field.mode === "circle" ? <circle key="field-guide" cx={diagram.field.centerX} cy={diagram.field.centerY} r={diagram.field.radiusPx} fill="none" stroke="#39d98a" strokeWidth="4" strokeDasharray="14 10" onPointerDown={handleGuidePointerDown} className={diagram.fieldGuideLocked ? "locked-background" : "draggable"} /> : <rect key="field-guide" x={diagram.field.x} y={diagram.field.y} width={diagram.field.widthPx} height={diagram.field.heightPx} fill="none" stroke="#39d98a" strokeWidth="4" strokeDasharray="14 10" onPointerDown={handleGuidePointerDown} className={diagram.fieldGuideLocked ? "locked-background" : "draggable"} />;
  const renderSelectionHighlight = () => {
    if (!selectedId) return null;
    const common = selectedObject ?? selectedImage;
    if (common) { const p = metersToPixels(diagram.field, common.x, common.y); const s = metersToSizePixels(diagram.field, common.widthM, common.heightM); if (selectedImage?.renderMode === "fan") return <path data-export-ignore="true" className="selection-highlight" d={imageFanPath(diagram.field, selectedImage)} />; return <rect data-export-ignore="true" className="selection-highlight" x={p.x - s.width / 2 - 5} y={p.y - s.height / 2 - 5} width={s.width + 10} height={s.height + 10} transform={`rotate(${-common.rotation} ${p.x} ${p.y})`} />; }
    if (selectedAoe) { const p = metersToPixels(diagram.field, selectedAoe.x, selectedAoe.y); if (selectedAoe.kind === "circle") return <circle data-export-ignore="true" className="selection-highlight" cx={p.x} cy={p.y} r={meterRadiusPx(diagram.field, selectedAoe.radiusM) + 5} />; if (selectedAoe.kind === "rect") { const s = metersToSizePixels(diagram.field, selectedAoe.widthM, selectedAoe.heightM); return <rect data-export-ignore="true" className="selection-highlight" x={p.x - s.width / 2 - 5} y={p.y - s.height / 2 - 5} width={s.width + 10} height={s.height + 10} transform={`rotate(${-selectedAoe.rotation} ${p.x} ${p.y})`} />; } if (selectedAoe.kind === "donut") return <path data-export-ignore="true" className="selection-highlight" d={donutPath(diagram.field, selectedAoe)} />; if (selectedAoe.kind === "tether" || selectedAoe.kind === "arrow") { const line = aoeLinePoints(diagram.field, selectedAoe); return <line data-export-ignore="true" className="selection-highlight" x1={line.start.x} y1={line.start.y} x2={line.end.x} y2={line.end.y} strokeWidth={Math.max(meterRadiusPx(diagram.field, selectedAoe.strokeWidthM), 2) + 8} />; } return <path data-export-ignore="true" className="selection-highlight" d={fanPath(diagram.field, selectedAoe)} />; }
    return null;
  };
  const renderLayerRow = (l: (typeof layers)[number], compact = false) => {
    const item = l.object ?? l.image ?? l.aoe;
    const label = item?.label ?? l.id;
    const locked = item?.locked ?? false;
    const visible = item?.visible ?? false;
    const number = layers.findIndex((x) => x.id === l.id) + 1;
    const imageAsset = l.image ? diagram.assets.find((asset) => asset.id === l.image?.assetId) : undefined;
    const icon = l.object ? <img src={l.object.href} alt="" /> : l.image ? <img src={imageAsset?.iconHref ?? l.image.href} alt="" /> : <span className={`layer-symbol ${l.aoe?.kind ?? ""}`} />;
    return <div key={l.id} onClick={() => setSelectedId(l.id)} className={`${selectedId === l.id ? "layer-row selected" : "layer-row"} ${compact ? "nested-layer" : ""}`}><span className="layer-number">{number}</span><span className="layer-icon">{icon}</span><button className="layer-name" onClick={(e) => { e.stopPropagation(); setSelectedId(l.id); }}>{label}</button><button onClick={(e) => { e.stopPropagation(); l.object ? updateObject(l.id, { visible: !l.object.visible }) : l.image ? updateImageObject(l.id, { visible: !l.image.visible }) : l.aoe && updateAoe(l.id, { visible: !l.aoe.visible }); }}>{visible ? <Eye size={15} /> : <EyeOff size={15} />}</button><button onClick={(e) => { e.stopPropagation(); l.object ? updateObject(l.id, { locked: !l.object.locked }) : l.image ? updateImageObject(l.id, { locked: !l.image.locked }) : l.aoe && updateAoe(l.id, { locked: !l.aoe.locked }); }}>{locked ? <Lock size={15} /> : <LockOpen size={15} />}</button><button onClick={(e) => { e.stopPropagation(); moveLayer(l.id, -1); }}>Up</button><button onClick={(e) => { e.stopPropagation(); moveLayer(l.id, 1); }}>Dn</button><button onClick={(e) => { e.stopPropagation(); deleteId(l.id); }} disabled={!!locked}><Trash2 size={15} /></button></div>;
  };
  const renderFolder = (folder: LayerFolder) => { const folderLayers = folder.itemIds.map((id) => layers.find((l) => l.id === id)).filter(Boolean) as (typeof layers); return <div key={folder.id} className="layer-folder"><div className="folder-row"><button onClick={() => updateFolder(folder.id, { expanded: !folder.expanded })}>{folder.expanded ? "-" : "+"}</button><button onClick={() => updateFolder(folder.id, { visible: !folder.visible })}>{folder.visible ? <Eye size={15} /> : <EyeOff size={15} />}</button><button onClick={() => updateFolder(folder.id, { locked: !folder.locked })}>{folder.locked ? <Lock size={15} /> : <LockOpen size={15} />}</button><input value={folder.label} onChange={(e) => updateFolder(folder.id, { label: e.target.value })} /></div>{folder.expanded && folderLayers.map((l) => renderLayerRow(l, true))}</div>; };
  const gridColumns = `${leftCollapsed ? 44 : leftPanelWidth}px minmax(360px, 1fr) ${rightCollapsed ? 44 : rightPanelWidth}px`;

  return (
    <main className={`app-shell ${leftCollapsed ? "left-collapsed" : ""} ${rightCollapsed ? "right-collapsed" : ""}`} style={{ gridTemplateColumns: gridColumns }}>
      <aside className="panel left-panel setup-panel">
        <div className="brand"><Grid3X3 size={24} /><div><strong>FFXIV Raid Diagram <span className="brand-credit">@SQUARE ENIX</span></strong></div></div>
        <section className="setup-section setup-background"><h2>Background</h2><label>Arena Images<select value={arenaImageUrl} onChange={(e) => { setArenaImageUrl(e.target.value); void loadArenaImage(e.target.value); }}><option value="">Select Arena Image</option>{availableArenaImages.map((image) => <option key={image.url} value={image.url}>{image.patch === "Local" ? image.name : `${image.patch} / ${image.content} / ${image.name}`}</option>)}</select></label>{arenaImageStatus && <p className="error-message">{arenaImageStatus}</p>}<label className="file-button icon-only" title="Upload backgrounds" aria-label="Upload backgrounds"><ImagePlus size={18} /><input type="file" accept="image/*" multiple onChange={async (e) => { const files = Array.from(e.target.files ?? []); if (!files.length) return; const backgrounds = await Promise.all(files.map(async (file) => makeBackground(file.name, await readRaster(file)))); addBackgrounds(backgrounds); }} /></label><button className="setup-settings-toggle" title="Setup" aria-label="Setup" onClick={() => setSetupOpen((v) => !v)}><Settings size={18} /></button>{setupOpen && <div className="setup-settings-panel">{diagram.backgrounds.length > 0 && <div className="setup-settings-block"><h3>Background</h3><label>Active background<select value={diagram.activeBackgroundId ?? ""} onChange={(e) => setActiveBackground(e.target.value)}>{diagram.backgrounds.map((bg) => <option key={bg.id} value={bg.id}>{bg.name}</option>)}</select></label>{diagram.background && <><div className="button-row"><button onClick={() => updateBackground({ visible: !diagram.background?.visible })}>{diagram.background.visible ? "Hide" : "Show"}</button><button onClick={() => updateBackground({ locked: !diagram.background?.locked })}>{diagram.background.locked ? "Unlock" : "Lock"}</button><button onClick={removeActiveBackground}>Remove</button></div><div className="form-grid"><label>X px<NumberInput value={diagram.background.x} onChange={(v) => updateBackground({ x: v })} disabled={diagram.background.locked} /></label><label>Y px<NumberInput value={diagram.background.y} onChange={(v) => updateBackground({ y: v })} disabled={diagram.background.locked} /></label><label>Width px<NumberInput value={diagram.background.width} onChange={(v) => updateBackground({ width: v })} disabled={diagram.background.locked} /></label><label>Height px<NumberInput value={diagram.background.height} onChange={(v) => updateBackground({ height: v })} disabled={diagram.background.locked} /></label><label>Opacity<NumberInput value={diagram.background.opacity} min={0} max={1} step={0.05} onChange={(v) => updateBackground({ opacity: v })} disabled={diagram.background.locked} /></label></div></>}</div>}<div className="setup-settings-block"><h3>Field Guide</h3><div className="segmented"><button className={diagram.field.mode === "circle" ? "active" : ""} onClick={() => commit((c) => ({ ...c, field: { mode: "circle", centerX: 512, centerY: 512, radiusPx: 360, radiusM: 20 } }))}>Circle</button><button className={diagram.field.mode === "rect" ? "active" : ""} onClick={() => commit((c) => ({ ...c, field: { mode: "rect", x: 152, y: 152, widthPx: 720, heightPx: 720, widthM: 40, heightM: 40 } }))}>Rect</button></div>{diagram.field.mode === "circle" ? <div className="form-grid"><label>Center X m<NumberInput value={0} onChange={() => undefined} disabled /></label><label>Center Y m<NumberInput value={0} onChange={() => undefined} disabled /></label><label>Radius m<NumberInput value={diagram.field.radiusM} onChange={(v) => updateField({ radiusM: v || 0.1 })} /></label><label>Diameter m<NumberInput value={diagram.field.radiusM * 2} onChange={(v) => updateField({ radiusM: (v || 0.2) / 2 })} /></label><details className="details-grid"><summary>Pixel guide</summary><div className="form-grid"><label>Center X px<NumberInput value={diagram.field.centerX} onChange={(v) => updateField({ centerX: v })} /></label><label>Center Y px<NumberInput value={diagram.field.centerY} onChange={(v) => updateField({ centerY: v })} /></label><label>Radius px<NumberInput value={diagram.field.radiusPx} onChange={(v) => updateField({ radiusPx: v || 1 })} /></label></div></details></div> : <div className="form-grid"><label>Width m<NumberInput value={diagram.field.widthM} onChange={(v) => updateField({ widthM: v || 0.1 })} /></label><label>Height m<NumberInput value={diagram.field.heightM} onChange={(v) => updateField({ heightM: v || 0.1 })} /></label><details className="details-grid"><summary>Pixel guide</summary><div className="form-grid"><label>X px<NumberInput value={diagram.field.x} onChange={(v) => updateField({ x: v })} /></label><label>Y px<NumberInput value={diagram.field.y} onChange={(v) => updateField({ y: v })} /></label><label>Width px<NumberInput value={diagram.field.widthPx} onChange={(v) => updateField({ widthPx: v || 1 })} /></label><label>Height px<NumberInput value={diagram.field.heightPx} onChange={(v) => updateField({ heightPx: v || 1 })} /></label></div></details></div>}</div></div>}</section>
      </aside>
      <aside className="panel asset-panel">
        <button className="panel-collapse-toggle" title={leftCollapsed ? "Open asset panel" : "Collapse asset panel"} onClick={() => setLeftCollapsed((v) => !v)}><PanelLeft size={18} /></button>
        <section className="assets-section"><h2>Assets</h2><label>Import category<select value={importCategory} onChange={(e) => setImportCategory(e.target.value as AssetCategory)}>{categories.map((c) => <option key={c} value={c}>{c}</option>)}</select></label><label className="file-button"><Upload size={18} /> Import assets<input type="file" accept="image/*" multiple onChange={async (e) => { const files = Array.from(e.target.files ?? []); const assets = await Promise.all(files.map(async (file) => { const img = await readRaster(file); return { id: crypto.randomUUID(), name: file.name.replace(/\.[^.]+$/, ""), category: importCategory, href: img.href, tags: [], source: "import" as const }; })); commit((c) => ({ ...c, assets: [...c.assets, ...assets] })); }} /></label>{categories.map((cat) => <details key={cat} className="asset-category" open><summary>{cat}</summary><div className="asset-grid">{sortAssetsForCategory(cat, diagram.assets.filter((a) => a.category === cat)).map((a) => <button key={a.id} className="asset-tile" title={a.name} draggable onDragStart={(e) => e.dataTransfer.setData("text/asset-id", a.id)} onClick={() => addAssetToCanvas(a)}><img src={a.iconHref ?? a.href} alt="" /></button>)}</div></details>)}</section>
        <details className="panel-section" open><summary>SVG AoE</summary><div className="segmented"><button className={aoeKind === "circle" ? "active" : ""} onClick={() => setAoeKind("circle")}>Circle</button><button className={aoeKind === "rect" ? "active" : ""} onClick={() => setAoeKind("rect")}>Rect</button><button className={aoeKind === "fan" ? "active" : ""} onClick={() => setAoeKind("fan")}>Fan</button><button className={aoeKind === "donut" ? "active" : ""} onClick={() => setAoeKind("donut")}>Donut</button><button className={aoeKind === "tether" ? "active" : ""} onClick={() => setAoeKind("tether")}>Tether</button><button className={aoeKind === "arrow" ? "active" : ""} onClick={() => setAoeKind("arrow")}>Arrow</button></div><div className="form-grid"><label>Name<input value={aoeDraft.label} onChange={(e) => setAoeDraft((d) => ({ ...d, label: e.target.value }))} /></label><label>X m<NumberInput value={aoeDraft.x} onChange={(v) => setAoeDraft((d) => ({ ...d, x: v }))} /></label><label>Y m<NumberInput value={aoeDraft.y} onChange={(v) => setAoeDraft((d) => ({ ...d, y: v }))} /></label><label>Color<input type="color" value={aoeDraft.color} onChange={(e) => setAoeDraft((d) => ({ ...d, color: e.target.value }))} /></label><label>Opacity<NumberInput value={aoeDraft.opacity} min={0} max={1} step={0.05} onChange={(v) => setAoeDraft((d) => ({ ...d, opacity: v }))} /></label>{(aoeKind === "circle" || aoeKind === "fan") && <label>Radius m<NumberInput value={aoeDraft.radiusM} onChange={(v) => setAoeDraft((d) => ({ ...d, radiusM: v }))} /></label>}{aoeKind === "donut" && <><label>Outer radius m<NumberInput value={aoeDraft.outerRadiusM} onChange={(v) => setAoeDraft((d) => ({ ...d, outerRadiusM: v }))} /></label><label>Inner radius m<NumberInput value={aoeDraft.innerRadiusM} onChange={(v) => setAoeDraft((d) => ({ ...d, innerRadiusM: v }))} /></label></>}{aoeKind === "rect" && <><label>Width m<NumberInput value={aoeDraft.widthM} onChange={(v) => setAoeDraft((d) => ({ ...d, widthM: v }))} /></label><label>Height m<NumberInput value={aoeDraft.heightM} onChange={(v) => setAoeDraft((d) => ({ ...d, heightM: v }))} /></label><label>Rotation<NumberInput value={aoeDraft.rotation} onChange={(v) => setAoeDraft((d) => ({ ...d, rotation: v }))} /></label></>}{aoeKind === "fan" && <><label>Angle<NumberInput value={aoeDraft.angleDeg} onChange={(v) => setAoeDraft((d) => ({ ...d, angleDeg: v }))} /></label><label>Direction<NumberInput value={aoeDraft.directionDeg} onChange={(v) => setAoeDraft((d) => ({ ...d, directionDeg: v }))} /></label></>}{(aoeKind === "tether" || aoeKind === "arrow") && <><label>Length m<NumberInput value={aoeDraft.lengthM} onChange={(v) => setAoeDraft((d) => ({ ...d, lengthM: v }))} /></label><label>Line width m<NumberInput value={aoeDraft.strokeWidthM} min={0.05} step={0.05} onChange={(v) => setAoeDraft((d) => ({ ...d, strokeWidthM: v }))} /></label><label>Direction<NumberInput value={aoeDraft.directionDeg} onChange={(v) => setAoeDraft((d) => ({ ...d, directionDeg: v }))} /></label></>}</div><button className="wide" onClick={addAoe}>Add SVG AoE</button></details>
        <section className="assets-section marker-preset-section"><h2>Field Marker Preset</h2><div className="form-grid"><label>Radius m<NumberInput value={markerPresetRadius} min={0} step={0.5} onChange={setMarkerPresetRadius} /></label></div><div className="button-row"><button onClick={() => addFieldMarkerPreset("A")}>A pattern</button><button onClick={() => addFieldMarkerPreset("B")}>B pattern</button></div></section>
      </aside>
      <section className="workspace"><div className="topbar"><div className="snap-control"><button onClick={undo} disabled={!undoStack.length}><Undo2 size={17} /> Undo</button><button onClick={redo} disabled={!redoStack.length}><Redo2 size={17} /> Redo</button><button className={panMode ? "active-tool" : ""} onClick={() => setPanMode((v) => !v)}>Pan</button><label><input type="checkbox" checked={diagram.snap.gridVisible} onChange={(e) => setSnap({ gridVisible: e.target.checked })} /> Grid</label><label><input type="checkbox" checked={diagram.fieldGuideVisible} onChange={(e) => commit((c) => ({ ...c, fieldGuideVisible: e.target.checked }))} /> Field Guide</label><label><input type="checkbox" checked={diagram.snap.grid} onChange={(e) => setSnap({ grid: e.target.checked })} /> Snap</label><label>Grid m<NumberInput value={diagram.snap.gridSizeM} min={0.25} step={0.25} onChange={(v) => setSnap({ gridSizeM: v || 1 })} /></label><label>Minor<input type="color" value={diagram.snap.minorColor} onChange={(e) => setSnap({ minorColor: e.target.value })} /></label><label>Major<input type="color" value={diagram.snap.majorColor} onChange={(e) => setSnap({ majorColor: e.target.value })} /></label><label>Opacity<NumberInput value={diagram.snap.gridOpacity} min={0} max={1} step={0.05} onChange={(v) => setSnap({ gridOpacity: v })} /></label><label>Zoom<select value={zoom} onChange={(e) => setZoom(Number(e.target.value))}><option value={0.5}>50%</option><option value={0.75}>75%</option><option value={1}>100%</option><option value={1.5}>150%</option><option value={2}>200%</option></select></label></div><div className="top-actions"><div className="meter-readout">1m = {scale.x.toFixed(2)}px / {scale.y.toFixed(2)}px | Pan: Pan button / Space+drag / right drag{spaceDown || panMode ? " ready" : ""}</div><div className={"autosave-status " + autoSaveStatus} title={autoSaveMessage}>Auto Save: {autoSaveStatus === "saving" ? "saving" : autoSaveStatus === "dirty" ? "unsaved" : autoSaveStatus === "error" ? "error" : "saved"}</div><button onClick={resetToBlankProject}>Reset Blank</button><button onClick={() => setShowHelp(true)}><HelpCircle size={18} /></button></div></div><div ref={canvasWrapRef} className="canvas-wrap" onPointerDown={handleCanvasPanPointerDown} onContextMenu={(e) => e.preventDefault()} onWheel={(e) => { if (!e.ctrlKey) return; e.preventDefault(); const levels = [0.5, 0.75, 1, 1.5, 2]; const index = levels.indexOf(zoom); setZoom(levels[Math.min(levels.length - 1, Math.max(0, index + (e.deltaY > 0 ? -1 : 1)))]); }}><svg ref={svgRef} className="diagram-canvas" style={{ width: canvasSize.width * zoom, height: canvasSize.height * zoom }} viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const a = diagram.assets.find((x) => x.id === e.dataTransfer.getData("text/asset-id")); const svg = svgRef.current; const t = svg?.getScreenCTM(); if (!a || !svg || !t) return; const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; const sp = p.matrixTransform(t.inverse()); const m = pixelsToMeters(diagram.field, sp.x, sp.y); addAssetToCanvas(a, m.x, m.y); }}><rect width={canvasSize.width} height={canvasSize.height} fill="#10151f" onPointerDown={(e) => { if (e.button === 0 && !panMode && !spaceDownRef.current) setSelectedId(null); }} />{diagram.background?.visible && <image key={diagram.background.id} href={diagram.background.href} x={diagram.background.x} y={diagram.background.y} width={diagram.background.width} height={diagram.background.height} opacity={diagram.background.opacity} preserveAspectRatio="none" onPointerDown={handleBackgroundPointerDown} className={diagram.background.locked ? "locked-background" : "draggable"} />}{diagram.snap.gridVisible && <g opacity={diagram.snap.gridOpacity} pointerEvents="none">{gridLines.map((l) => <line key={l.id} {...l} stroke={l.major ? diagram.snap.majorColor : diagram.snap.minorColor} strokeWidth={l.major ? 1.15 : 0.55} opacity={l.major ? 0.5 : 0.25} />)}</g>}{diagram.snap.gridVisible && diagram.fieldGuideVisible && renderFieldGuide()}{layers.filter((l) => l.id !== "background").slice().reverse().map((l) => renderLayer(l.id))}{renderSelectionHighlight()}</svg></div></section>
      <aside className="panel right-panel">
        <button className="panel-collapse-toggle" title={rightCollapsed ? "Open right panel" : "Collapse right panel"} onClick={() => setRightCollapsed((v) => !v)}><PanelLeft size={18} /></button>
        <div className="panel-resizer panel-resizer-left" onPointerDown={(e) => startPanelResize("right", e)} />
        <details className="panel-section" open><summary>Timeline</summary><div className="button-row"><button onClick={createSceneFromCurrent}>Save current</button><button onClick={createBlankScene}>Blank scene</button></div><div className="scene-list">{diagram.scenes.map((scene) => <div key={scene.id} className={diagram.activeSceneId === scene.id ? "scene-row active" : "scene-row"}><button onClick={() => switchScene(scene.id)}>{diagram.activeSceneId === scene.id ? "On" : "Go"}</button><input value={scene.name} onChange={(e) => updateScene(scene.id, { name: e.target.value })} /><button onClick={() => duplicateScene(scene.id)}>Copy</button><button onClick={() => deleteScene(scene.id)}><Trash2 size={14} /></button><textarea value={scene.notes} placeholder="Memo" onChange={(e) => updateScene(scene.id, { notes: e.target.value })} /></div>)}</div>{!diagram.scenes.length && <p className="empty">Save current to start a timeline.</p>}</details>
        
        <details className="panel-section" open><summary>Layers</summary><button className="wide" onClick={createFolderFromSelection} disabled={!selectedId || selectedId === "background" || selectedId === "field-guide"}>New folder from selected</button><div className="folder-tools"><select value={selectedFolder?.id ?? ""} disabled={!selectedId || selectedId === "background" || selectedId === "field-guide" || !diagram.folders.length} onChange={(e) => e.target.value && moveSelectedToFolder(e.target.value)}><option value="">Move selected to folder</option>{diagram.folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.label}</option>)}</select><button onClick={removeSelectedFromFolder} disabled={!selectedFolder}>Remove from folder</button></div><div className="layer-list">{diagram.folders.map(renderFolder)}{layers.filter((l) => !folderItemIds.has(l.id)).map((l) => renderLayerRow(l))}</div></details>
        <details className="panel-section" open><summary>Selected</summary><button className="wide" onClick={() => selectedId && deleteId(selectedId)} disabled={!selectedId || !!selectedLocked || selectedId === "field-guide"}>Delete selected</button><SelectedPanel selectedObject={selectedObject} selectedImage={selectedImage} selectedAoe={selectedAoe} assets={diagram.assets} iconAssets={iconAssets} updateObject={updateObject} updateImageObject={updateImageObject} updateAoe={updateAoe} addPlayerIcon={addPlayerIcon} updatePlayerIconList={updatePlayerIconList} locked={!!selectedLocked} /></details>
        <details className="panel-section" open><summary>Save / Export</summary><div className="button-row"><button onClick={exportJson}><Save size={17} /> JSON</button><label className="file-button small"><FileDown size={17} /> Load<input type="file" accept="application/json,.json" onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} /></label></div><button className="wide" onClick={exportPng}><Download size={17} /> PNG</button></details>
      </aside>
      {confirmDialog && <div className="modal-backdrop" onClick={() => closeConfirm(false)}><div className="modal confirm-modal" onClick={(e) => e.stopPropagation()}><div className="modal-title"><h2>{confirmDialog.title}</h2></div><p>{confirmDialog.message}</p><div className="button-row"><button onClick={() => closeConfirm(false)}>{confirmDialog.cancelLabel}</button><button className="danger-button" onClick={() => closeConfirm(true)}>{confirmDialog.confirmLabel}</button></div></div></div>}
      {showHelp && <div className="modal-backdrop" onClick={() => setShowHelp(false)}><div className="modal" onClick={(e) => e.stopPropagation()}><div className="modal-title"><h2>Help</h2><button onClick={() => setShowHelp(false)}>Close</button></div><ul><li>Background is independent from Field Guide.</li><li>Field Guide defines meter scaling.</li><li>Assets can be image AoEs or ordinary objects.</li><li>Width and height are independent by default.</li><li>Pan the zoomed canvas with Space + drag, right drag, or middle drag.</li></ul></div></div>}
    </main>
  );
}

function IconList({ icons, assets, onChange, locked }: { icons: AppliedIcon[]; assets: LibraryAsset[]; onChange: (icons: AppliedIcon[]) => void; locked: boolean }) {
  return <div className="icon-list">{icons.map((icon, index) => { const asset = assets.find((a) => a.id === icon.assetId); return <div key={icon.id} className="icon-row"><button disabled={locked} onClick={() => onChange(icons.map((x) => x.id === icon.id ? { ...x, visible: !x.visible } : x))}>{icon.visible ? <Eye size={14} /> : <EyeOff size={14} />}</button>{asset && <img src={asset.href} alt="" />}<span>{asset?.name ?? "missing"}</span><button disabled={locked} onClick={() => onChange(moveItem(icons, index, -1))}>Up</button><button disabled={locked} onClick={() => onChange(moveItem(icons, index, 1))}>Dn</button><button disabled={locked} onClick={() => onChange(icons.filter((x) => x.id !== icon.id))}><Trash2 size={14} /></button></div>; })}</div>;
}
function SelectedPanel(props: { selectedObject?: CombatObject; selectedImage?: ImageObject; selectedAoe?: Aoe; assets: LibraryAsset[]; iconAssets: LibraryAsset[]; updateObject: (id: string, patch: Partial<CombatObject>) => void; updateImageObject: (id: string, patch: Partial<ImageObject>) => void; updateAoe: (id: string, patch: Partial<Aoe>) => void; addPlayerIcon: (type: "buffs" | "debuffs", assetId: string) => void; updatePlayerIconList: (type: "buffs" | "debuffs", icons: AppliedIcon[]) => void; locked: boolean }) {
  const { selectedObject, selectedImage, selectedAoe, locked } = props;
  const commonImage = selectedObject ?? selectedImage;
  return <>{commonImage && <><div className="selection-title">{commonImage.label}</div><div className="form-grid selected-grid"><label>Name<input value={commonImage.label} disabled={locked} onChange={(e) => selectedObject ? props.updateObject(commonImage.id, { label: e.target.value }) : props.updateImageObject(commonImage.id, { label: e.target.value })} /></label><label>X m<NumberInput value={commonImage.x} disabled={locked} onChange={(v) => selectedObject ? props.updateObject(commonImage.id, { x: v }) : props.updateImageObject(commonImage.id, { x: v })} /></label><label>Y m<NumberInput value={commonImage.y} disabled={locked} onChange={(v) => selectedObject ? props.updateObject(commonImage.id, { y: v }) : props.updateImageObject(commonImage.id, { y: v })} /></label><label>Width m<NumberInput value={commonImage.widthM} disabled={locked} onChange={(v) => selectedObject ? props.updateObject(commonImage.id, { widthM: v }) : props.updateImageObject(commonImage.id, { widthM: v })} /></label><label>Height m<NumberInput value={commonImage.heightM} disabled={locked} onChange={(v) => selectedObject ? props.updateObject(commonImage.id, { heightM: v }) : props.updateImageObject(commonImage.id, { heightM: v })} /></label><label>Rotation<NumberInput value={commonImage.rotation} disabled={locked} onChange={(v) => selectedObject ? props.updateObject(commonImage.id, { rotation: v }) : props.updateImageObject(commonImage.id, { rotation: v })} /></label><label>Opacity<NumberInput value={commonImage.opacity} disabled={locked} min={0} max={1} step={0.05} onChange={(v) => selectedObject ? props.updateObject(commonImage.id, { opacity: v }) : props.updateImageObject(commonImage.id, { opacity: v })} /></label>{selectedImage?.renderMode === "fan" && <label>Arc Angle<NumberInput value={selectedImage.arcAngleDeg ?? 90} disabled={locked} min={1} max={359} step={1} onChange={(v) => props.updateImageObject(selectedImage.id, { arcAngleDeg: Math.max(1, Math.min(v, 359)) })} /></label>}</div>{selectedObject?.kind === "player" && <><h3>Buffs</h3><select disabled={locked} defaultValue="" onChange={(e) => { props.addPlayerIcon("buffs", e.target.value); e.currentTarget.value = ""; }}><option value="">Add icon</option>{props.iconAssets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select><IconList locked={locked} icons={selectedObject.buffs} assets={props.assets} onChange={(icons) => props.updatePlayerIconList("buffs", icons)} /><h3>Debuffs</h3><select disabled={locked} defaultValue="" onChange={(e) => { props.addPlayerIcon("debuffs", e.target.value); e.currentTarget.value = ""; }}><option value="">Add icon</option>{props.iconAssets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select><IconList locked={locked} icons={selectedObject.debuffs} assets={props.assets} onChange={(icons) => props.updatePlayerIconList("debuffs", icons)} /></>}</>}{selectedAoe && <><div className="selection-title">{selectedAoe.label}</div><div className="form-grid selected-grid"><label>Name<input value={selectedAoe.label} disabled={locked} onChange={(e) => props.updateAoe(selectedAoe.id, { label: e.target.value })} /></label><label>X m<NumberInput value={selectedAoe.x} disabled={locked} onChange={(v) => props.updateAoe(selectedAoe.id, { x: v })} /></label><label>Y m<NumberInput value={selectedAoe.y} disabled={locked} onChange={(v) => props.updateAoe(selectedAoe.id, { y: v })} /></label><label>Color<input type="color" value={selectedAoe.color} disabled={locked} onChange={(e) => props.updateAoe(selectedAoe.id, { color: e.target.value })} /></label><label>Opacity<NumberInput value={selectedAoe.opacity} disabled={locked} min={0} max={1} step={0.05} onChange={(v) => props.updateAoe(selectedAoe.id, { opacity: v })} /></label>{selectedAoe.kind === "circle" && <label>Radius m<NumberInput value={selectedAoe.radiusM} disabled={locked} onChange={(v) => props.updateAoe(selectedAoe.id, { radiusM: v })} /></label>}{selectedAoe.kind === "rect" && <><label>Width m<NumberInput value={selectedAoe.widthM} disabled={locked} onChange={(v) => props.updateAoe(selectedAoe.id, { widthM: v })} /></label><label>Height m<NumberInput value={selectedAoe.heightM} disabled={locked} onChange={(v) => props.updateAoe(selectedAoe.id, { heightM: v })} /></label><label>Rotation<NumberInput value={selectedAoe.rotation} disabled={locked} onChange={(v) => props.updateAoe(selectedAoe.id, { rotation: v })} /></label></>}{selectedAoe.kind === "fan" && <><label>Radius m<NumberInput value={selectedAoe.radiusM} disabled={locked} onChange={(v) => props.updateAoe(selectedAoe.id, { radiusM: v })} /></label><label>Angle<NumberInput value={selectedAoe.angleDeg} disabled={locked} onChange={(v) => props.updateAoe(selectedAoe.id, { angleDeg: v })} /></label><label>Direction<NumberInput value={selectedAoe.directionDeg} disabled={locked} onChange={(v) => props.updateAoe(selectedAoe.id, { directionDeg: v })} /></label></>}{selectedAoe.kind === "donut" && <><label>Outer radius m<NumberInput value={selectedAoe.outerRadiusM} disabled={locked} onChange={(v) => props.updateAoe(selectedAoe.id, { outerRadiusM: v })} /></label><label>Inner radius m<NumberInput value={selectedAoe.innerRadiusM} disabled={locked} onChange={(v) => props.updateAoe(selectedAoe.id, { innerRadiusM: v })} /></label></>}{(selectedAoe.kind === "tether" || selectedAoe.kind === "arrow") && <><label>Length m<NumberInput value={selectedAoe.lengthM} disabled={locked} onChange={(v) => props.updateAoe(selectedAoe.id, { lengthM: v })} /></label><label>Line width m<NumberInput value={selectedAoe.strokeWidthM} disabled={locked} min={0.05} step={0.05} onChange={(v) => props.updateAoe(selectedAoe.id, { strokeWidthM: v })} /></label><label>Direction<NumberInput value={selectedAoe.directionDeg} disabled={locked} onChange={(v) => props.updateAoe(selectedAoe.id, { directionDeg: v })} /></label></>}</div></>}</>;
}

createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
