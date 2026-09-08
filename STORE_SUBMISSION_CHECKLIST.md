# ChatRivet v1.3.2 リリース準備チェックリスト

このチェックリストは、公開済みv1.3.1の互換性修正版として、現在のmainを基に公式Recentリンクへの安全なクリック委譲によるSPAナビゲーション改善を含むv1.3.2を準備し、Chrome Web Storeへ提出するために使用します。Dashboard変更・審査送信は、ユーザーの最終承認後に行います。

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
- [x] `STORE_LISTING.md`に日本語・英語の正式文面、Privacy practices、審査テスト手順をまとめる。
- [x] `_locales/ja/messages.json`と`_locales/en/messages.json`に日本語・英語metadataを用意する。
- [x] 日本語ChromeとEnglish (United States) ChromeでName / Descriptionの解決を実機確認する。
- [x] v1.2.0で作成した正式スクリーンショット3枚が現行仕様と一致し、日本語・英語Listingで共通利用できることを確認する。
- [x] 共通利用するスクリーンショットに個人情報・旧名称・エラー表示が含まれないことを確認する。
- [ ] 公開済みの`PRIVACY.md` URLがアクセス可能で、現在のデータ取扱いと一致することを確認する。

## 申請版ソース

- [x] `manifest.json`の`version`を`1.3.2`へ更新する。
- [x] `default_locale`が`ja`で、manifestのName / Descriptionが`__MSG_*__`参照であることを確認する。
- [x] `node --check content.js`、manifest JSON検証、`git diff --check`を実行する。
- [x] Manifestの権限が`storage`のみ、対象が`https://chatgpt.com/*`のみであることを確認する。
- [x] 日本語・英語localeのJSON、キー、manifest message参照の整合性を自動テストする。
- [x] 通常Recentの同一conversation IDに一致する安全で一意な公式リンクへ通常クリックを委譲し、対象不在・曖昧・切断時は従来hrefへfallbackすることを自動テスト・実機確認する。
- [x] SPA同期、Project、安全側fallback、modifier・keyboard操作、Recent共存を含む申請版の全65件回帰テストを行う。
- [ ] 公式Pinnedなし、pins 0件、既存チャット`/c/{id}`の初回操作を再確認する。
- [ ] Chrome拡張機能管理画面に新規エラーがないことを確認する。
- [x] 申請用変更だけを最終Diffレビューする。

## Developer Dashboard入力

- [ ] 名称: ChatRivet
- [ ] カテゴリ: ツール
- [ ] デフォルト言語: 日本語
- [ ] 追加言語: English
- [ ] サポートURL: `https://github.com/kmcapps/chatrivet-extension/issues`
- [ ] プライバシーポリシーURL: `https://github.com/kmcapps/chatrivet-extension/blob/main/PRIVACY.md`
- [ ] 日本語Listingの短い説明・詳細説明を`STORE_LISTING.md`と一致させる。
- [ ] English ListingのShort description / Detailed descriptionを`STORE_LISTING.md`と一致させる。
- [ ] 日本語・英語Listingで同じ正式スクリーンショット3枚を設定する。
- [ ] 審査担当者向け英語テスト手順を入力する。
- [ ] Privacy practicesの`storage`理由へ、ピン情報・色・表示順のローカル保存を記載する。
- [ ] 保存情報としてchatId、サイドバー上のタイトル、pinnedAt、ユーザー選択色、pins配列順による表示順を記載する。
- [ ] データ分類としてWeb history、Website content、User activityを選択する。
- [ ] 単一目的、`https://chatgpt.com/*`への限定アクセス、Remote codeなしを再確認する。
- [ ] Chromeプロファイル単位の保存、外部送信なし、会話本文・Cookie・認証情報を扱わないことを掲載文とPrivacy practicesで一致させる。

## 提出ZIP

- [x] `dist/ChatRivet-1.3.2.zip`を新規作成する。
- [x] ZIPのルートに実行に必要な次のファイルだけが含まれることを確認する。
  - `manifest.json`
  - `content.js`
  - `styles.css`
  - `icons/icon-16.png`
  - `icons/icon-32.png`
  - `icons/icon-48.png`
  - `icons/icon-128.png`
  - `_locales/ja/messages.json`
  - `_locales/en/messages.json`
- [x] `.git`、文書、`store-assets/`、`tools/`、スクリーンショット、テスト・モックをZIPへ含めていないことを確認する。
- [x] ZIP内Manifestが有効で、versionが`1.3.2`であることを確認する。
- [x] ZIP内実行ファイルと現在の申請準備ソースのハッシュが一致することを確認する。
- [ ] ZIPを別の場所へ展開し、展開した正確な提出物をChromeへ読み込んで実機テストする。

## Git・リリース

- [ ] Commit直前の`git status`とDiffを確認する。
- [ ] ユーザー承認後に申請版Commitを作成する。
- [ ] 検証済みZIPが申請版Commitと一致することを確認する。
- [ ] 問題がなければ申請版Commitへ注釈付きtag `v1.3.2`を作成する。
- [ ] release branchをPushし、安全にmainへ統合する。
- [ ] mainと`v1.3.2` tagをoriginへPushする。
- [ ] ローカルmain、origin/main、`v1.3.2`が意図したCommitを指すことを確認する。

## Dashboard最終監査・再提出

- [ ] 新ZIPをChrome Web Store Developer Dashboardへアップロードする。
- [ ] Dashboardに表示されるversionが`1.3.2`であることを確認する。
- [ ] 日本語・英語Store Listing、Privacy practices、販売地域、テスト手順、掲載素材を最終監査する。
- [ ] Red Potassium拒否対象だった追加・表示・移動・解除の再現手順が明確であることを確認する。
- [ ] ユーザーの最終承認を得る。
- [ ] 最終承認後に「審査のため送信」を実行する。

## 提出停止条件

- 新スクリーンショットまたは新ZIPが未検証。
- 正確な提出ZIPを使った実機テストが未完了。
- Privacy practicesと実装・文書の保存情報が一致していない。
- 英語テスト手順がDashboardへ入力されていない。
- 最終回帰テスト、Diff監査、ユーザー最終承認のいずれかが未完了。
