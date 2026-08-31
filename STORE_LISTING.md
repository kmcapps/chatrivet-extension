# ChatRivet — Chrome Web Store 掲載情報案

このファイルは、Chrome Web Storeの入力内容を確認するためのローカル準備資料です。公開申請時にはDeveloper Dashboardの実際の入力項目と照合します。

## 基本情報

- 名称: ChatRivet
- カテゴリ: ツール
- デフォルト言語: 日本語
- 追加言語: English
- 料金: 無料
- サポートURL: https://github.com/kmcapps/chatrivet-extension/issues
- プライバシーポリシーURL: https://github.com/kmcapps/chatrivet-extension/blob/main/PRIVACY.md

## 公開連絡先

- Developer Dashboardの公開・検証済み連絡先: `kmcapps.dev@gmail.com`
- 状態: 取得済み・検証済み。Chrome Web Store Developer Dashboardの公開連絡先として使用する。
- 拡張機能のサポート窓口: GitHub Issues（上記Support URL）

## 日本語 Store Listing

## 短い説明（132文字以内）

ChatGPTの左サイドバーにローカル保存の独自ピン一覧を追加し、重要なチャットへすばやく戻れる拡張機能。

## 詳細説明

ChatRivetは、ChatGPTの左サイドバーに独自のピン一覧を追加し、よく使うチャットへすばやく戻るための拡張機能です。

現在開いているチャットをChatRivetへ追加すると、公式の「ピン留め」とは別の一覧として、ChatGPT左サイドバーのチャット履歴付近に表示します。公式「ピン留め」がない環境でも、利用可能なサイドバー構造に合わせて安全な位置へ表示します。適切な表示位置が見つからない場合は、公式UIを壊さないため無理に挿入しません。ChatRivetへ追加しても公式の「最近」一覧にはそのまま表示され、同じチャットが両方の一覧に表示されます。公式「最近」の「…」メニューを引き続き利用でき、ChatRivetから解除しても公式履歴の表示には影響しません。

主な機能

- 現在開いているChatGPTチャットを独自一覧へ追加
- 一覧から対象チャットへ移動
- いつでもピン解除
- ピンごとの色分け（固定8色）
- 専用ドラッグハンドルによるピンの手動並べ替え
- ピン情報・色・表示順をChromeのローカルストレージに保存
- ChatGPTの画面遷移とサイドバー再描画に追従
- ライト／ダークテーマに追従

プライバシー

ChatRivetは、チャットID、左サイドバーに表示されるチャットタイトル、ピン留め日時、ユーザーが選択したピンの色、ユーザーが設定したピンの表示順だけをChromeのローカルストレージに保存します。保存単位はChatGPTアカウントではなくChromeプロファイルです。同じChromeプロファイル内で複数のChatGPTアカウントを切り替える場合、ピン一覧は共有されます。外部サーバーへの送信、分析・追跡、会話本文・入力内容・Cookie・認証情報の取得や保存は行いません。

対応サイトは `https://chatgpt.com/*` のみです。ChatRivetはOpenAIまたはChatGPTの公式拡張機能ではありません。ChatGPT側のUI変更により、表示できなくなる場合があります。

## 日本語 Privacy practices 入力案

### Single purpose

ChatGPTの左サイドバーに、ユーザーが選んだチャットのローカル専用ピン一覧を追加し、重要な会話へすばやく移動できるようにすること。

### Permission justification: storage

ユーザーが追加したピンのチャットID、サイドバー上のタイトル、ピン留め日時、ユーザーが選択したピンの色、ユーザーが設定したピンの表示順をChromeのローカルストレージに保存し、ブラウザ再起動後も独自ピン一覧を維持するために使用します。

### Host access justification: https://chatgpt.com/*

ChatRivetの単一目的はChatGPTの左サイドバー内で独自ピン一覧を表示・操作することです。この機能のため、content scriptは `https://chatgpt.com/*` にのみ限定して実行します。

### Remote code

No, I am not using remote code.

### Data usage

ユーザーがピンに追加したチャットについて、ChatGPTのサイドバーに表示されるタイトルと、対象ページのチャットID、ピン留め日時、ユーザーが選択したピンの色、ユーザーが設定したピンの表示順をChromeプロファイル内にローカル保存します。ChatGPTアカウントごとの自動分離は行いません。外部送信、販売、広告、分析、追跡は行いません。

Developer Dashboardでは「Web history」「Website content」「User activity」を選択し、申請直前に実際の選択肢と照合して正確に申告します。

### 申請時の事前開示・同意

ストア掲載文とPrivacy practicesで、チャットID・サイドバー上のタイトル・ピン留め日時・ユーザーが選択したピンの色・pins配列順による表示順をローカル保存し、独自ピン一覧の表示・移動・解除・色分け・並べ替えのためだけに使用することを明示する。公開前にDeveloper Dashboard上の同意・認証項目を確認し、必要な同意取得を完了する。

## English Store Listing

### Name

ChatRivet

### Short description

Add a locally saved custom pin list to the ChatGPT sidebar for quick access to important conversations.

### Detailed description

ChatRivet adds a custom pin list to the ChatGPT left sidebar so you can quickly return to conversations you use often.

When you add the currently open conversation, ChatRivet displays it near the chat history in a list that is separate from ChatGPT's official Pinned section. An official Pinned section is not required. ChatRivet uses an available safe sidebar position and does not force insertion when no safe position is available. Adding a conversation to ChatRivet does not remove it from the official Recent list. The same conversation remains available in both lists, the official Recent `...` menu continues to work, and removing a ChatRivet pin does not affect the official history.

Key features

- Add the currently open ChatGPT conversation to a custom list
- Open a conversation from the ChatRivet list
- Remove a pin at any time
- Organize pins with eight fixed colors
- Reorder pins manually with a dedicated drag handle
- Save pin details, colors, and display order in Chrome local storage
- Follow ChatGPT page navigation and sidebar redraws
- Follow light and dark themes

Privacy

ChatRivet stores only the conversation ID, the title shown in the ChatGPT sidebar, the time the pin was added, the user-selected pin color, and the user-defined pin order in Chrome local storage. Storage is scoped to the Chrome profile, not the ChatGPT account. If multiple ChatGPT accounts are used in the same Chrome profile, they share the same ChatRivet pin list. ChatRivet does not transmit this data to external servers and does not collect or store conversation bodies, message input, cookies, or authentication information. It does not use data for advertising, analytics, tracking, or sale.

ChatRivet runs only on `https://chatgpt.com/*`. It is not an official OpenAI or ChatGPT extension. Changes to the ChatGPT interface may affect availability.

### Privacy practices

#### Single purpose

Add a local-only custom pin list to the ChatGPT left sidebar so users can quickly open conversations they choose.

#### Permission justification: storage

The `storage` permission is used to save each pinned conversation ID, sidebar title, pin timestamp, user-selected color, and user-defined display order in Chrome local storage so the custom pin list remains available after the browser restarts.

#### Host access justification: https://chatgpt.com/*

ChatRivet's single purpose is to display and operate its custom pin list inside the ChatGPT left sidebar. Its content script therefore runs only on `https://chatgpt.com/*`.

#### Remote code

No, I am not using remote code.

#### Data usage

For conversations the user pins, ChatRivet stores the conversation ID, the title shown in the ChatGPT sidebar, the pin timestamp, the selected color, and the array order used for display. The data stays in the Chrome profile. ChatRivet does not transmit, sell, advertise with, analyze, or track this data.

Select `Web history`, `Website content`, and `User activity` in Developer Dashboard, then verify the available choices immediately before submission.

## Test instructions / 審査テスト手順案（English）

No ChatRivet-specific account, paid ChatGPT plan, or special setup is required.
Any standard ChatGPT account with at least one existing conversation can be used.

1. Open `https://chatgpt.com/` and sign in.
2. After installing the extension, reload the ChatGPT tab once.
3. Open an existing conversation and confirm that the URL contains `/c/`.
4. Expand the left sidebar.
5. Find the ChatRivet section near the chat history. An official Pinned section is not required.
6. Click the `+` button next to ChatRivet.
7. Confirm that the currently open conversation appears in the ChatRivet list.
8. Click the conversation title to open it.
9. Confirm that the conversation is still visible in the official Recent list, then click `×` to remove the ChatRivet pin. The conversation should remain in Recent.

Additional feature checks:

- Click the color marker to select a color or choose `None` to clear it.
- Drag the six-dot handle to change the order of pinned conversations.

## 掲載素材チェックリスト

- 128x128 PNGストアアイコン
- 440x280 PNGまたはJPEGの小型プロモーション画像
- 1280x800 PNGの実機スクリーンショット（最低1枚、最大5枚。3枚を予定）
- 任意: 1400x560 PNGまたはJPEGのマーキー画像
- 任意: 機能紹介YouTube動画

### Shared screenshots for Japanese and English

The following current screenshots are shared across the Japanese and English Store Listings. Do not upload the older v1.1.0 screenshots.

- `store-assets/ChatRivet-v1.2.0-store-01-basic.png`
- `store-assets/ChatRivet-v1.2.0-store-02-organize.png`
- `store-assets/ChatRivet-v1.2.0-store-03-recent-coexist.png`
