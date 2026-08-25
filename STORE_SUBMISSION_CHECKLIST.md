# ChatRivet v1.0 申請直前チェックリスト

このチェックリストはChrome Web Storeへの初回申請直前に使用します。申請・公開そのものは、このファイルを作成した時点では実行しません。

## 未完了の外部手続き

- [x] `kmcapps.dev@gmail.com` を取得する。
- [x] Chrome Web Store Developer Dashboardに公開・検証済み連絡先として登録し、検証を完了する。
- [ ] Developer Dashboardの本人確認・二段階認証など、表示される公開要件を完了する。

## 公開物

- [x] Manifest用PNGアイコン: 16、32、48、128px
- [x] 小型プロモーション画像: 440x280 PNG
- [x] 実機スクリーンショット: 1280x800 PNGを3枚。撮影内容は`SCREENSHOT_CAPTURE_GUIDE.md`に従い、個人情報を含めない。
- [x] プライバシーポリシー案: `PRIVACY.md`
- [x] 掲載情報案: `STORE_LISTING.md`
- [ ] `PRIVACY.md`をCommit・Pushし、公開URLを確認する。

## 申請版のソース

- [x] `manifest.json`の`version`を`1.0.0`へ変更する。
- [x] 公開ZIP `dist/ChatRivet-1.0.0.zip` を作成し、展開後のManifestと実行ファイル構成を検証する。
- [x] `node --check content.js`、manifest JSON検証、拡張機能の再読み込み、ChatGPTタブ再読み込みを行う。
- [x] MVPの手動テストを行う: 追加、移動、解除、公式「最近」の重複非表示と再表示、SPA遷移、ページ再読み込み、コンソールエラーなし。
- [ ] 今回の申請用変更だけをレビューする。
- [ ] ユーザー承認後に申請版Commitを作成する。
- [ ] ユーザー承認後に申請版CommitをPushし、`v1.0.0`タグを作成する。

## Developer Dashboard入力

- [ ] 名称: ChatRivet
- [ ] カテゴリ: Productivity
- [ ] 主な言語: 日本語
- [ ] サポートURL: `https://github.com/kmcapps/chatrivet-extension/issues`
- [ ] プライバシーポリシーURL: 公開済みの`PRIVACY.md`
- [ ] 短い説明・詳細説明: `STORE_LISTING.md`の案を貼り付け、最新仕様と照合する。
- [ ] Privacy practices: 保存データ、Chromeプロファイル単位のローカル保存、外部送信なしを正確に申告する。
- [ ] Privacy practices: 実際の選択肢を確認し、Website content／Web historyなど該当するデータ分類のみを選ぶ。
- [ ] Privacy practices: 単一目的、`storage`権限、`https://chatgpt.com/*`への限定アクセス、Remote codeなしを入力する。
- [ ] 掲載文とPrivacy practicesで、保存するデータと利用目的を事前に明確に開示し、Dashboardで求められる同意・認証を完了する。

## 提出ZIP

ZIPのルートには、実行に必要な次だけを含める。

- `manifest.json`
- `content.js`
- `styles.css`
- `icons/icon-16.png`
- `icons/icon-32.png`
- `icons/icon-48.png`
- `icons/icon-128.png`

含めないもの: `.git`、`README.md`、`PRIVACY.md`、`STORE_LISTING.md`、`STORE_SUBMISSION_CHECKLIST.md`、`store-assets/`、`tools/`、スクリーンショット、開発用ファイル。

## 提出停止条件

- メールアドレスの取得・検証が未完了。
- 公開用スクリーンショットが未作成または個人情報を含む。
- Privacy practicesの選択肢を実画面で確認できていない。
- 最終版の動作確認または最終レビューが未完了。
