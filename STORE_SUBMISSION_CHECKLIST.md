# ChatRivet v1.2.0 リリース準備チェックリスト

このチェックリストは、現在のmainを基にv1.2.0を準備し、Chrome Web Storeへ提出するために使用します。Dashboard変更・審査送信は、ユーザーの最終承認後に行います。

## 開発者アカウント

- [x] `kmcapps.dev@gmail.com`を取得する。
- [x] Chrome Web Store Developer Dashboardの連絡先メール検証を完了する。
- [x] Developer登録と2段階認証を完了する。

## 既存審査対策・Recent共存

- [x] 公式Pinned / Recentを任意アンカーとし、安全なmount fallbackを実装する。
- [x] 公式PinnedなしでもChatRivetが表示されることを実機確認する。
- [x] 既存チャットで`+`が表示され、最初のピンを追加できることを実機確認する。
- [x] ChatRivet登録中も同じチャットが公式Recentに表示されることを実機確認する。
- [x] 公式Recentの「…」メニューを利用できることを実機確認する。
- [x] ChatRivetから解除しても公式Recentの表示へ影響しないことを実機確認する。
- [x] 既存機能の回帰テストとDiff監査を完了する。

## 公開物・文書

- [x] 新しい丸型ChatRivet画像からManifest用PNGアイコン（16、32、48、128px）を作成する。
- [x] 小型プロモーション画像: 440x280 PNG
- [x] プライバシーポリシー: `PRIVACY.md`
- [x] v1.2.0の機能・配置・保存情報に合わせて`STORE_LISTING.md`を更新する。
- [ ] 色分け、6点ハンドル、公式Pinnedなしの表示、公式Recentとの共存を反映した新しいスクリーンショットを確認する。
- [ ] 新しいスクリーンショットに個人情報・旧名称・エラー表示が含まれないことを確認する。
- [ ] 公開済みの`PRIVACY.md` URLがアクセス可能で、現在のデータ取扱いと一致することを確認する。

## 申請版ソース

- [x] `manifest.json`の`version`を`1.2.0`へ更新する。
- [x] `node --check content.js`、manifest JSON検証、`git diff --check`を実行する。
- [x] Manifestの権限が`storage`のみ、対象が`https://chatgpt.com/*`のみであることを確認する。
- [ ] 色分け、手動並べ替え、mount fallbackを含む申請版の全回帰テストを行う。
- [ ] 公式Pinnedなし、pins 0件、既存チャット`/c/{id}`の初回操作を再確認する。
- [ ] Chrome拡張機能管理画面に新規エラーがないことを確認する。
- [ ] 申請用変更だけを最終Diffレビューする。

## Developer Dashboard入力

- [ ] 名称: ChatRivet
- [ ] カテゴリ: ツール
- [ ] 主な言語: 日本語
- [ ] サポートURL: `https://github.com/kmcapps/chatrivet-extension/issues`
- [ ] プライバシーポリシーURL: `https://github.com/kmcapps/chatrivet-extension/blob/main/PRIVACY.md`
- [ ] 短い説明・詳細説明をv1.2.0の機能、mount fallback、公式Recentとの共存へ合わせて更新する。
- [ ] 審査担当者向け英語テスト手順を入力する。
- [ ] Privacy practicesの`storage`理由へ、ピン情報・色・表示順のローカル保存を記載する。
- [ ] 保存情報としてchatId、サイドバー上のタイトル、pinnedAt、ユーザー選択色、pins配列順による表示順を記載する。
- [ ] データ分類としてWeb history、Website content、User activityを選択する。
- [ ] 単一目的、`https://chatgpt.com/*`への限定アクセス、Remote codeなしを再確認する。
- [ ] Chromeプロファイル単位の保存、外部送信なし、会話本文・Cookie・認証情報を扱わないことを掲載文とPrivacy practicesで一致させる。

## 提出ZIP

- [ ] `dist/ChatRivet-1.2.0.zip`を新規作成する。
- [ ] ZIPのルートに実行に必要な次のファイルだけが含まれることを確認する。
  - `manifest.json`
  - `content.js`
  - `styles.css`
  - `icons/icon-16.png`
  - `icons/icon-32.png`
  - `icons/icon-48.png`
  - `icons/icon-128.png`
- [ ] `.git`、文書、`store-assets/`、`tools/`、スクリーンショット、テスト・モックをZIPへ含めていないことを確認する。
- [ ] ZIP内Manifestが有効で、versionが`1.2.0`であることを確認する。
- [ ] ZIP内実行ファイルと申請版Commitのハッシュが一致することを確認する。
- [ ] ZIPを別の場所へ展開し、展開した正確な提出物をChromeへ読み込んで実機テストする。

## Git・リリース

- [ ] Commit直前の`git status`とDiffを確認する。
- [ ] ユーザー承認後に申請版Commitを作成する。
- [ ] 検証済みZIPが申請版Commitと一致することを確認する。
- [ ] 問題がなければ申請版Commitへ注釈付きtag `v1.2.0`を作成する。
- [ ] release branchをPushし、安全にmainへ統合する。
- [ ] mainと`v1.2.0` tagをoriginへPushする。
- [ ] ローカルmain、origin/main、`v1.2.0`が意図したCommitを指すことを確認する。

## Dashboard最終監査・再提出

- [ ] 新ZIPをChrome Web Store Developer Dashboardへアップロードする。
- [ ] Dashboardに表示されるversionが`1.2.0`であることを確認する。
- [ ] Store Listing、Privacy practices、販売地域、テスト手順、掲載素材を最終監査する。
- [ ] Red Potassium拒否対象だった追加・表示・移動・解除の再現手順が明確であることを確認する。
- [ ] ユーザーの最終承認を得る。
- [ ] 最終承認後に「審査のため送信」を実行する。

## 提出停止条件

- 新スクリーンショットまたは新ZIPが未検証。
- 正確な提出ZIPを使った実機テストが未完了。
- Privacy practicesと実装・文書の保存情報が一致していない。
- 英語テスト手順がDashboardへ入力されていない。
- 最終回帰テスト、Diff監査、ユーザー最終承認のいずれかが未完了。
