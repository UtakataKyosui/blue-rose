# 青薔薇 / blue-rose

Notionで記事を書き、Blumeで検索可能な静的サイトとして公開します。ホームなどは`docs/`のMarkdown/MDXで管理し、Notionの記事は`/notion/`配下に並びます。

## ローカルで起動する

Node.js 22.19以上とpnpm 10.20.0を使います。

```sh
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env.local
# .env.local に接続情報を設定
pnpm dev
```

Blumeが`.env.local`を読み込みます。トークンをGitに追加しないでください。

| 環境変数 | 内容 |
| --- | --- |
| `NOTION_TOKEN` | NotionのInternal connectionのアクセストークン |
| `NOTION_DATABASE_ID` | データベースID。フルページで開いたURLの`?v=`より前にある32文字のID |
| `NOTION_PUBLISHED_VALUE` | 公開するStatusの値。既定は`Done`。大文字・小文字も一致させる |
| `SITE_URL` | 本番のURL。既定は`https://blume-blog.vercel.app` |

既存設定との互換性のため`NOTION_DATASOURCE_ID`も受け付けますが、**値はデータベースID**でなければなりません。data source IDやview IDでは動きません。両方ある場合は`NOTION_DATABASE_ID`を優先します。Blumeはデータベース内の最初のdata sourceを読みます。

## Notionを接続する

1. Notionの開発者ポータルでInternal connectionを作り、読み取り権限を付けます。
2. Content access、またはデータベースの「接続を追加」から、対象のデータベースそのものを共有します。リンクドビューを置いた親ページの共有だけでは足りません。
3. トークンとデータベースIDを`.env.local`に設定します。
4. 以下のプロパティを作り、少なくとも公開記事と下書きを1件ずつ用意します。

| プロパティ | Notionの型 | 用途 |
| --- | --- | --- |
| タイトル（名前は任意） | Title | 記事タイトル。Slugが空ならURLにも使う |
| `Description` | Text | 記事の説明・検索エンジン用の説明 |
| `Slug` | Text | 例：`getting-started`、`guides/setup` |
| `Order` | Number | サイドバーでの表示順 |
| `Status` | StatusまたはSelect | `Done`で公開。それ以外の値は下書き |

タイトル以外はBlume上では任意ですが、公開制御のため**Statusを作り、すべての記事に値を入れてください**。Blumeの仕様上、Statusが空、またはプロパティ自体がない記事は公開されます。`Published`や`公開済み`を使う場合は`NOTION_PUBLISHED_VALUE`を同じ文字列に設定します。プロパティ名を変更したい場合は`blume.config.ts`の`notion()`に`properties: { status: "公開状態", slug: "URL", order: "表示順" }`などを追加します。

Slugが`guides/setup`の記事は`/notion/guides/setup/`になります。Slug未設定時はタイトルから生成されるため、URLを固定したい記事にはSlugを設定してください。Notion内のページリンクは自動でサイトのURLに変換されません。記事同士は`/notion/guides/setup/`のようにサイト上のパスでリンクします。

## 執筆・公開の流れ

```sh
pnpm dev      # 下書きも表示。60秒ごとにNotionを再取得
pnpm sync     # 手動で再取得し、起動中の開発サーバーに反映
pnpm build    # Notionを再取得し、本番用の静的ファイルをdist/へ出力
pnpm preview  # 最後のビルドを確認
pnpm doctor   # 設定を診断（Notionの接続情報が必要）
pnpm test     # 実際のNotionを使わない本番ビルドの回帰テスト
```

`pnpm build`は下書きをHTML・サイドバー・検索・サイトマップから除外します。`pnpm dev`で見えていた下書きのURLが、`pnpm preview`では404になることを確認してください。下書きを含む`blume build --preview`は公開先には使わず、アクセス制限のあるレビュー環境に限定します。

見出しはHeading 2/3を推奨します。段落・リスト・To-do・引用・コード・コールアウト・トグル・カラム・画像・動画を取り込めます。画像はビルド時にダウンロードされるため、Notionの署名付きURLが切れた後も表示されます。表・ブックマーク・埋め込み・数式・同期ブロック・子ページは取り込まれないため、公開前に表示を確認してください。Notionの文章は通常のテキストとして扱い、MDX実行は有効にしていません。

## Vercelで公開する

1. このリポジトリをVercelにImportします。既存プロジェクトを使う場合も以下を確認します。
2. Node.jsを22以上にし、Install Commandを`pnpm install --frozen-lockfile`にします。`vercel.json`でBuild Commandは`pnpm build`、Output Directoryは`dist`に指定しています。
3. ProductionとPreviewの環境変数に`NOTION_TOKEN`、`NOTION_DATABASE_ID`を設定します。必要なら`NOTION_PUBLISHED_VALUE`と`SITE_URL`も設定します。
4. デプロイします。独自ドメインを設定したら`SITE_URL`も変更し、再ビルドします。

トークンはビルド時だけ使われ、読者向けの静的ページには含まれません。記事本文は公開されるので、Statusを含めた内容の確認は必要です。

### Notionの変更を自動反映する

Notionの編集は次のビルドで公開サイトに反映されます。

1. VercelのProject Settings → Git → Deploy Hooksで、本番ブランチ`main`向けのHookを作ります。
2. GitHubのSettings → Secrets and variables → Actionsに、Hook URLを`VERCEL_DEPLOY_HOOK`という**Secret**として登録します。
3. マージ後、Actions → Rebuild docs from Notion → Run workflowで動作確認します。

ワークフローは毎時17分（UTC）に実行されます。GitHubのスケジュールは遅延する場合があります。Secret未設定時は設定方法を示して失敗します。Hook呼び出し成功はビルド完了を意味しないため、VercelのDeploymentsで完了を確認してください。Hook URLは再ビルドを起動できる秘密情報です。

Notionの有料プランでデータベースオートメーションを使う場合は、Statusの変更をトリガーにHookへのPOSTを設定できます。ただし本文だけの編集はStatus変更を発火しないので、定期実行も残します。

## 検証とトラブルシューティング

PRのCIではNotionの接続情報を渡さず、テスト用Notionクライアントを注入して実ビルドを検証します。公開・下書き、Slug、Order、本文変換、画像の保存、検索・サイトマップを確認します。実際のワークスペースとの接続は、環境変数設定後に別途確認してください。

- **記事がない**：Statusと`NOTION_PUBLISHED_VALUE`の完全一致を確認し、`pnpm sync`または再ビルドします。
- **データベースが見つからない**：connectionへの共有と、database/data source/view IDの取り違えを確認します。
- **`BLUME_MISSING_SECRET`**：ローカルの`.env.local`、またはVercelのビルド環境に`NOTION_TOKEN`を設定します。
- **古い内容が出る**：Notion取得失敗時にBlumeがキャッシュを使う場合があります。`BLUME_SOURCE_OFFLINE`警告と接続を確認します。`.blume/`のスナップショットには下書きも含まれるので、公開・コミットしないでください。

参考：[Notionからドキュメントサイトを公開するガイド](https://useblume.dev/guides/notion-documentation-website) · [Notion source](https://useblume.dev/docs/content/sources/notion)
