# FFXIV Raid Diagram

FF14のギミック処理図を作るための、React + TypeScript + Vite製Webツールです。

背景画像やフィールド画像の見た目ではなく、ユーザーが指定したField Guideを基準にメートル換算します。プレイヤー、ボス、画像素材、SVG AoEはm座標で管理し、描画時だけSVGのpx座標へ変換します。

## セットアップ

```bash
npm install
```

## ローカル起動

```bash
npm run dev
```

通常は `http://localhost:5173` で開きます。

## ビルド確認

```bash
npm run build
```

成果物は `dist/` に出力されます。

## 主な機能

- BackgroundImageの複数アップロード、切り替え、移動、サイズ変更、透明度変更、ロック
- GitHubリポジトリからArena Image一覧を読み込み、BackgroundImageとして選択
- 円形/四角形Field Guideによる有効フィールド範囲設定
- Field Guide基準のm座標変換
- Players / Boss / AoE / Markers / Field Markers / Buffs / Debuffs / Custom のAsset管理
- Assetのクリック/ドラッグ配置
- SVG AoE: Circle / Rect / Fan / Donut
- 画像AoE配置
- Circle AoE画像から作るImage Fan AoE
- PlayerへのBuff/Debuff付与
- 番号とアイコン付きレイヤー選択、表示/非表示、ロック、削除、前面/背面移動
- レイヤーフォルダ
- Timeline / Sceneの保存
- Grid / Snap / Zoom / Pan
- Undo / Redo
- IndexedDB自動保存
- JSON保存/読み込み
- PNG出力

## 自動保存

作業状態はブラウザのIndexedDBに自動保存されます。

- オブジェクト、シーン、Assets、BackgroundImage、画像データも保存対象です
- 起動時に前回の作業状態を自動復元します
- 初期状態に戻したい場合は上部バーの `Reset Blank` を使います
- JSON保存はバックアップ、共有、別ブラウザへの移行用です

注意: IndexedDBはブラウザごとの保存です。GitHub Pagesで公開しても、編集状態は各ユーザーのブラウザ内に保存されます。ほかの人へ共有する場合はJSONを書き出して渡してください。

## JSON保存形式の概要

JSONは現在のプロジェクト状態を保存します。将来の複数シーン/タイムラインに対応しやすいように、`scenes` と `activeSceneId` を含みます。

```json
{
  "version": 1,
  "activeSceneId": "scene-id",
  "scenes": [
    {
      "id": "scene-id",
      "name": "Scene 1",
      "notes": "",
      "state": {
        "background": null,
        "field": {
          "mode": "circle",
          "centerX": 512,
          "centerY": 512,
          "radiusPx": 360,
          "radiusM": 20
        },
        "objects": [],
        "imageObjects": [],
        "aoes": [],
        "folders": [],
        "layerOrder": []
      }
    }
  ],
  "background": null,
  "field": {
    "mode": "circle",
    "centerX": 512,
    "centerY": 512,
    "radiusPx": 360,
    "radiusM": 20
  },
  "objects": [],
  "imageObjects": [],
  "aoes": [],
  "assets": [],
  "folders": [],
  "layerOrder": [],
  "snap": {
    "grid": true,
    "gridVisible": true,
    "gridSizeM": 1,
    "gridOpacity": 0.55,
    "minorColor": "#89a6c7",
    "majorColor": "#d0e6ff"
  }
}
```

`objects`、`imageObjects`、`aoes` の `x` / `y` はm単位です。右方向が `+X`、上方向が `+Y` です。BackgroundImageの位置とサイズは測量補助用なのでpx単位で、m換算には使いません。

## GitHub Pagesで公開する

このプロジェクトにはGitHub Pages用のWorkflowを含めています。

使うファイル:

- `.github/workflows/pages.yml`
- `npm run build:pages`

公開手順:

1. GitHubにリポジトリを作成します。
2. このプロジェクトをGitHubへpushします。
3. GitHubのリポジトリ画面で `Settings` を開きます。
4. `Pages` を開きます。
5. `Build and deployment` の `Source` を `GitHub Actions` にします。
6. `main` ブランチへpushすると自動で公開されます。

`vite.config.ts` の `base` は `/raid-diagram/` に設定しています。公開URLは `https://ユーザー名.github.io/raid-diagram/` を想定しています。
