# ChatRivet — Chrome Web Store 掲載情報案

このファイルは、Chrome Web Storeの入力内容を確認するためのローカル準備資料です。公開申請時にはDeveloper Dashboardの実際の入力項目と照合します。

## 基本情報

- 名称: ChatRivet
- カテゴリ: Productivity
- 主な言語: 日本語
- 料金: 無料
- サポートURL: https://github.com/kmcapps/chatrivet-extension/issues
- プライバシーポリシーURL（Commit・Push後）: https://github.com/kmcapps/chatrivet-extension/blob/main/PRIVACY.md

## 公開連絡先

- Developer Dashboardの公開・検証済み連絡先: `kmcapps.dev@gmail.com`
- 状態: 取得済み・検証済み。Chrome Web Store Developer Dashboardの公開連絡先として使用する。
- 拡張機能のサポート窓口: GitHub Issues（上記Support URL）

## 短い説明（132文字以内）

ChatGPTの左サイドバーにローカル保存の独自ピン一覧を追加し、重要なチャットへすばやく戻れる拡張機能。

## 詳細説明

ChatRivetは、ChatGPTの左サイドバーに独自のピン一覧を追加し、よく使うチャットへすばやく戻るための拡張機能です。

現在開いているチャットをChatRivetへ追加すると、公式の「ピン留め」とは別の一覧として、左サイドバーの「ピン留め」と「最近」の間に表示します。ChatRivetに追加したチャットは、公式の「最近」一覧では重複表示されません。ピンを解除すると、公式の「最近」一覧に再び表示されます。

主な機能

- 現在開いているChatGPTチャットを独自一覧へ追加
- 一覧から対象チャットへ移動
- いつでもピン解除
- ピンごとの色分け（固定8色）
- ChatGPTの画面遷移とサイドバー再描画に追従
- ライト／ダークテーマに追従

プライバシー

ChatRivetは、チャットID、左サイドバーに表示されるチャットタイトル、ピン留め日時、ユーザーが選択したピンの色だけをChromeのローカルストレージに保存します。保存単位はChatGPTアカウントではなくChromeプロファイルです。同じChromeプロファイル内で複数のChatGPTアカウントを切り替える場合、ピン一覧は共有されます。外部サーバーへの送信、分析・追跡、会話本文・入力内容・Cookie・認証情報の取得や保存は行いません。

対応サイトは `https://chatgpt.com/*` のみです。ChatRivetはOpenAIまたはChatGPTの公式拡張機能ではありません。ChatGPT側のUI変更により、表示できなくなる場合があります。

## Privacy practices 入力案

### Single purpose

ChatGPTの左サイドバーに、ユーザーが選んだチャットのローカル専用ピン一覧を追加し、重要な会話へすばやく移動できるようにすること。

### Permission justification: storage

ユーザーが追加したピンのチャットID、サイドバー上のタイトル、ピン留め日時、ユーザーが選択したピンの色をChromeのローカルストレージに保存し、ブラウザ再起動後も独自ピン一覧を維持するために使用します。

### Host access justification: https://chatgpt.com/*

ChatRivetの単一目的はChatGPTの左サイドバー内で独自ピン一覧を表示・操作することです。この機能のため、content scriptは `https://chatgpt.com/*` にのみ限定して実行します。

### Remote code

No, I am not using remote code.

### Data usage

ユーザーがピンに追加したチャットについて、ChatGPTのサイドバーに表示されるタイトルと、対象ページのチャットID、ピン留め日時、ユーザーが選択したピンの色をChromeプロファイル内にローカル保存します。ChatGPTアカウントごとの自動分離は行いません。外部送信、販売、広告、分析、追跡は行いません。

Developer Dashboardの分類では、少なくとも「Website content」と「Web history」に該当する可能性があるため、申請直前に実際の選択肢と照合して正確に申告します。

### 申請時の事前開示・同意

ストア掲載文とPrivacy practicesで、チャットID・サイドバー上のタイトル・ピン留め日時・ユーザーが選択したピンの色をローカル保存し、独自ピン一覧の表示・移動・解除・色分けのためだけに使用することを明示する。公開前にDeveloper Dashboard上の同意・認証項目を確認し、必要な同意取得を完了する。

## 審査テスト手順案

1. `https://chatgpt.com/` を開き、ChatGPTへログインします。
2. 既存のチャットを開くと、左サイドバーの公式「ピン留め」と「最近」の間にChatRivetが表示されます。
3. ChatRivet見出しの「+」を押すと、現在のチャットが一覧へ追加されます。
4. 一覧のタイトルを選ぶと、対象チャットへ移動します。
5. ピン解除操作を行うと、ChatRivetから削除され、公式「最近」で再表示されます。

## 掲載素材チェックリスト

- 128x128 PNGストアアイコン
- 440x280 PNGまたはJPEGの小型プロモーション画像
- 1280x800 PNGの実機スクリーンショット（最低1枚、最大5枚。3枚を予定）
- 任意: 1400x560 PNGまたはJPEGのマーキー画像
- 任意: 機能紹介YouTube動画
