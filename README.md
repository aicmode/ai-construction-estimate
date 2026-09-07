# AI工事・リフォーム見積管理システム

工事会社・工務店・リフォーム会社向けの見積業務システムです。
Excelで属人化しがちな見積作成・原価管理・採算確認を、組織単位で共有できるWebシステムに置き換えることを目的としています。

顧客・工事案件・見積を関連付けて管理し、**明細から金額・原価・粗利益・粗利率を自動計算**、
**AIとルールエンジンによる見積チェック**、**日本語見積書PDFの発行**まで一貫して行えます。

> このリポジトリはポートフォリオ用の実装ですが、本番運用を前提に設計・検証しています。
> 同梱のデモデータはすべて架空であり、実在の個人・法人とは関係ありません。

---

## 主な機能

### ダッシュボード
- 今月の見積作成件数・見積総額
- 受注見込額（確認中・提出済み）／年間受注金額
- 平均粗利率（失注を除く加重平均・税抜ベース）
- 要注意見積件数（粗利率10%未満／期限切れ／期限7日以内）
- 直近6ヶ月の見積金額・受注金額の推移
- ステータス別件数、最近更新した見積、要注意見積の一覧

### 顧客管理
一覧・検索・詳細・新規作成・編集・削除。紐付く工事案件と見積を詳細画面から確認できます。

### 工事案件管理
案件名／顧客／工事種別／施工場所／工事概要／着工・完了予定日／担当者／ステータス／備考。
キーワード・ステータス・工事種別で絞り込みできます。

### 見積管理
- 見積番号の自動採番（`EST-2026-0001` 形式・組織別／年別・DBで一意性を保証）
- 明細の追加・削除・並べ替え（数量 × 単価を入力しながらリアルタイム計算）
- 小計／値引き／税抜合計／消費税／税込合計／原価合計／粗利益／粗利率
- ステータス管理（下書き・確認中・提出済み・受注・失注・期限切れ）
- 複製、論理削除（確認ダイアログ付き）
- キーワード・顧客・ステータス・発行日での絞り込み

### AI見積チェック
- **ルールエンジン**（常時動作・ネットワーク不要）: 粗利率閾値／販売単価 < 原価単価／数量0／単価0／
  原価未入力／過大な値引き／明細の偏り／重複明細／有効期限の矛盾・失効／支払条件・案件の未設定 など
- **AIレビュー**（APIキー設定時のみ）: 見積データを根拠にした確認事項の提示
- 結果は `severity` / `category` / `title` / `description` / `recommendedAction` の構造化データ
- AI障害・キー未設定・不正なJSON応答でもルールチェックは完全動作します

### 見積書PDF
A4縦・日本語の見積書をサーバー側で生成します。禁則処理付きの独自行分割により、
日本語の途中にハイフンが混入しません。

### ワンクリックデモログイン
`DEMO_USER_EMAIL` / `DEMO_USER_PASSWORD` を設定すると、ログイン画面に「デモ環境を見る」ボタンが表示されます。
通常ログインと同じ Supabase Auth・RLS を経由し、認証されたアカウントが設定値と一致すること、
組織とデモデータが揃っていることを確認したうえでダッシュボードへ遷移します。
資格情報はサーバー側でのみ読み込まれ、クライアントバンドルには含まれません。

### 会社設定
見積書の発行元情報（会社名・住所・連絡先・インボイス登録番号・振込先）と、
新規見積の初期値（消費税率・有効期間・支払条件）を設定します。

---

## 技術構成

| 領域 | 採用技術 | 選定理由 |
| --- | --- | --- |
| フレームワーク | Next.js 16（App Router） | Server Components と Server Actions で、認証・検証・計算をサーバー側に集約できる |
| 言語 | TypeScript（strict） | 金額計算とドメイン型の安全性 |
| スタイル | Tailwind CSS v4 | デザイントークンをCSSで一元管理 |
| DB | Supabase PostgreSQL | 本番想定。RLSでテナント分離を**DB層**で担保 |
| データアクセス | Supabase JS SDK（`@supabase/supabase-js` / `@supabase/ssr`） | ORMを使わず PostgREST 経由。Serverless のコネクションプール枯渇問題が原理的に発生しない |
| 認証 | Supabase Auth | Cookieベースのセッションを proxy（middleware）と Server Component の両方で検証 |
| 検証 | Zod v4 | クライアント・サーバーで同一スキーマを使用 |
| フォーム | React Hook Form + `@hookform/resolvers` | 明細行の動的追加・削除（`useFieldArray`） |
| アイコン | Lucide React | OS絵文字を使わない統一アイコン |
| PDF | `@react-pdf/renderer` + `@react-pdf/fontkit` | 純JS。Chromium非依存でVercel Serverlessで動作 |
| テスト | Vitest | 金額計算・ルールエンジン・AI応答検証・PDF行分割 |

### ORMを採用しなかった理由

Prisma などの ORM は Serverless 環境でコネクションプーリングの追加設定（PgBouncer / Data Proxy）を要し、
`prisma generate` がビルド時に必要になるなど、Vercelでの運用が複雑になります。
本システムは Supabase SDK（PostgREST）経由に統一することで、

- ビルド時にDBへ接続しない（`npm run build` はDBもAPIキーも不要）
- コネクション枯渇が構造上発生しない
- **RLSが必ず効く**（アプリのバグがあってもDBが他組織のデータを返さない）

という運用上の利点を優先しました。スキーマはSQLマイグレーションで、型は `src/lib/database.types.ts` で管理しています。

---

## セットアップ

### 必要環境
- Node.js 22 以上
- npm
- Supabase プロジェクト（クラウド）または Supabase CLI + Docker（ローカル）

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数

`.env.example` をコピーして `.env.local` を作成し、値を設定します。

```bash
cp .env.example .env.local
```

| 変数名 | 必須 | 用途 | 取得場所 |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase プロジェクトURL | Supabase → Project Settings → Data API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | 匿名（公開）キー。RLSで保護される | Supabase → Project Settings → API Keys |
| `SUPABASE_SERVICE_ROLE_KEY` | – | 未使用（将来の管理用途向け予約） | Supabase → Project Settings → API Keys |
| `AI_PROVIDER` | – | `anthropic` / `openai` / `disabled`（既定 `anthropic`） | – |
| `ANTHROPIC_API_KEY` | – | AIレビュー用。未設定でもアプリは動作 | Anthropic Console |
| `ANTHROPIC_MODEL` | – | 既定 `claude-sonnet-5` | – |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | – | `AI_PROVIDER=openai` の場合 | OpenAI Platform |
| `DEMO_USER_EMAIL` / `DEMO_USER_PASSWORD` | – | ログイン画面の「デモ環境を見る」ボタン用。サーバー側でのみ読み込まれ、ブラウザには渡りません。未設定ならボタンは無効化されます | 自分で作成したデモ用アカウント |
| `SEED_USER_EMAIL` / `SEED_USER_PASSWORD` | – | デモデータ投入用（ローカル開発のみ） | 自分で作成したアカウント |

`NEXT_PUBLIC_` が付く変数はブラウザに配信されます。**秘密情報を `NEXT_PUBLIC_` で定義しないでください。**
AI APIキーとデモログイン資格情報はサーバー側でのみ読み込まれ、クライアントバンドルには含まれません。
`DEMO_USER_EMAIL` と `DEMO_USER_PASSWORD` の両方を設定すると「デモ環境を見る」が有効になります。
通常ログインと新規登録はどちらの場合も利用できます。

### 3. Supabase のセットアップ

#### ローカル（Supabase CLI + Docker）

```bash
supabase start        # マイグレーションが自動適用されます
supabase status       # URL と anon key を確認して .env.local に設定
```

停止は `supabase stop`。

#### クラウド（本番・Vercelデプロイ用）

1. [supabase.com](https://supabase.com) でプロジェクトを作成
2. `supabase/migrations/` 内のSQLを **番号順に** 適用
   - CLI: `supabase link --project-ref <ref>` → `supabase db push`
   - または Dashboard → SQL Editor に各ファイルを貼り付けて実行
3. Project Settings → API から URL と anon key を取得して環境変数に設定

### 4. マイグレーション

| ファイル | 内容 |
| --- | --- |
| `0001_schema.sql` | 拡張機能・ENUM型・全テーブル・インデックス・トリガー |
| `0002_rls.sql` | 全テーブルのRLS有効化とポリシー |
| `0003_functions.sql` | `create_organization` / `next_estimate_number` |
| `0004_save_estimate.sql` | 見積ヘッダと明細をトランザクションで保存する `save_estimate` |
| `0005_demo_read_only.sql` | 共有デモアカウントの読み取り専用化（`profiles.is_demo` / RLS / トリガー / RPC） |

適用は番号順に行ってください。すべて再実行可能（冪等）です。

### 5. デモデータ（seed）

1. アプリを起動して**新規登録 → 組織作成**を先に行う
2. `.env.local` に `SEED_USER_EMAIL` / `SEED_USER_PASSWORD` を設定
3. 実行:

```bash
npm run db:seed
```

**安全設計:**
- 既存データを一切削除しません（追記のみ）
- anon key + ログインセッションで実行するため、**RLSが効いた状態**で自分の組織にしか書き込めません
- ローカル以外（`127.0.0.1` / `localhost` 以外）のURLに対しては `SEED_CONFIRM=yes` がない限り中断します

> **順序に注意:** seed は「ログインしたユーザーとして」RLS越しに書き込みます。
> デモ用アカウントを read-only 化（次節）した後は、そのアカウントでは seed できません。
> **必ず seed を先に実行し、そのあとで `is_demo` を立ててください。**

投入されるデータは戸建てキッチン改修／浴室リフォーム／外壁塗装／店舗内装／エアコン設備更新など、
すべて架空の内容で、備考欄に識別用マーカーが入ります。

### 6. デモアカウントの読み取り専用化

「デモ環境を見る」は**共有アカウント**です。誰でも同じ組織にログインするため、
そのままでは閲覧者がデータを編集・削除して次の閲覧者のデモを壊せてしまいます。

seed 完了後に、そのアカウントを read-only にします（SQL Editor で一度だけ実行）:

```sql
update public.profiles set is_demo = true where email = '<デモ用アドレス>';
```

解除する場合は `false` にします。フラグは**アプリからは変更できません**
（`protect_is_demo` トリガーが、ログイン中のセッションによる変更を拒否します）。

**この制御はDB側で完結しています。** `0005_demo_read_only.sql` により、

| 層 | 内容 |
| --- | --- |
| RLS | 全業務テーブルの INSERT / UPDATE / DELETE ポリシーに `not is_demo_user()` を追加。SELECT は変更なし |
| トリガー | 各テーブルの文レベル `BEFORE INSERT/UPDATE/DELETE` で拒否。**SECURITY DEFINER 関数の内側にも効きます** |
| RPC | `next_estimate_number` / `create_organization` / `save_estimate` が自身でフラグを検査 |

そのため、UIを介さず **Supabase REST / RPC を直接呼んでも書き込みは拒否されます**。
アプリ側（Server Actions・UI）の制御は、あくまで早期の分かりやすいエラー表示のためのものです。

`DEMO_USER_EMAIL` はログイン用の設定であり、**権限判定には使っていません**。
権限はDBの `profiles.is_demo` だけで決まります。

フラグを立てたあとは、実際に書き込みが拒否されるかを検証できます:

```bash
npm run demo:verify
```

デモアカウントでログインし、REST（RLS・トリガー）と RPC の両方に対して
INSERT / UPDATE / DELETE / 採番 / 組織作成を1回ずつ試み、**すべて拒否されること**と
**データが変化していないこと**を確認します。
`is_demo` が false のままの場合は、実データを汚さないよう検証自体を中止します。

---

## 開発コマンド

```bash
npm run dev        # 開発サーバー
npm run build      # 本番ビルド（DB・APIキー不要）
npm run start      # 本番サーバー
npm run typecheck  # TypeScript 型チェック
npm run lint       # ESLint
npm run test       # Vitest
npm run db:seed    # デモデータ投入
npm run demo:verify # デモアカウントが読み取り専用になっているか検証
```

### テスト

金額計算とビジネスロジックを対象にしています。

- `src/lib/estimate/calc.test.ts` — 数量×単価、原価、値引き、消費税、粗利益、粗利率、0除算、境界値
- `src/lib/ai/rules.test.ts` — ルールエンジンの各判定、重要度の並び順、市場相場に言及しないことの検証
- `src/lib/ai/review.test.ts` — AI連携（応答の検証・不正JSON・HTTPエラー・タイムアウト時のフォールバック、APIキー非漏洩）
- `src/lib/validation/estimate.test.ts` — 入力検証、クライアント送信の合計値が破棄されること
- `src/lib/validation/round-trip.test.ts` — 同一スキーマでの二重検証（ブラウザ→サーバー）が通ること
- `src/server/pdf/text.test.ts` — 日本語の行分割と禁則処理

---

## Vercel へのデプロイ

1. GitHub リポジトリを Vercel にインポート
2. Framework Preset: **Next.js**（自動検出）
3. Environment Variables に以下を設定（Production / Preview 両方）
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `DEMO_USER_EMAIL` / `DEMO_USER_PASSWORD`（デモログインを有効にする場合）
   - `ANTHROPIC_API_KEY`（AIレビューを使う場合のみ）
   - `ANTHROPIC_MODEL`（任意）
4. Deploy

### Serverless 互換性について

- **ビルド時にDBへ接続しません。** 環境変数が未設定でも `npm run build` は成功します
  （未設定時は `/setup-required` 画面が表示されます）
- PDF生成は **Node.js ランタイム**（`runtime = "nodejs"`）。Chromium や native module に依存しません
- 日本語フォントは `src/server/pdf/fonts/` に同梱し、`next.config.ts` の `outputFileTracingIncludes` で
  Serverless Function にトレースされます。**実行時に外部からフォントを取得しません**
- ファイルシステムへの書き込みは一切行いません（フォントの読み取りのみ）
- `src/proxy.ts`（Next.js 16 の middleware 相当）は Edge ランタイムで動作しますが、
  使用しているのは Supabase SSR のみで互換性を確認済みです
- Supabase へのアクセスはすべてサーバー側（Server Component / Server Action / Route Handler）で行います。
  ブラウザから直接DBを呼ぶコードは存在しません

---

## セキュリティ

| 対策 | 実装 |
| --- | --- |
| 認証 | Supabase Auth。`getUser()` でJWTを毎回検証（`getSession()` のCookie復号のみに依存しない） |
| 認可 | `src/proxy.ts` での早期リダイレクト + `(app)` レイアウトでのサーバー側再検証 |
| テナント分離 | 全業務テーブルに `organization_id`。RLSポリシーで所属組織以外は参照・更新・削除不可 |
| IDURL改ざん | 全クエリが `organization_id` でスコープ。他組織のIDを指定しても404 |
| 入力検証 | Zod スキーマをクライアント・サーバーの両方で適用。未知のキーは破棄 |
| 金額の信頼性 | クライアントが送る合計値はスキーマに存在せず、保存前に必ずサーバーで再計算 |
| SQLインジェクション | PostgREST のパラメータ化クエリ。検索文字列は `%` `_` `,` 等をエスケープ |
| XSS | React の自動エスケープ。`dangerouslySetInnerHTML` 不使用 |
| Secret管理 | AI APIキーはサーバー専用。`.env*` は Git 管理外（`.env.example` のみ追跡） |
| AI入力制限 | 明細80行・24,000文字・出力2,000トークン・25秒タイムアウトの上限 |
| Prompt Injection | 見積データを `<estimate_data>` で区切り、内部の指示に従わないようシステムプロンプトで明示。応答はZodで検証し、存在しない明細への参照は破棄 |
| 個人情報 | AIへ送るのは見積の商流情報のみ。顧客の連絡先は送信しない |
| エラーメッセージ | DBドライバの生エラーを画面に出さず、定型文とサーバーログに分離 |
| HTTPヘッダー | `X-Content-Type-Options` / `X-Frame-Options` / `Referrer-Policy` / `Permissions-Policy` |

### 市場相場について

本システムは市場価格データを保有していません。そのため、ルールエンジンもAIプロンプトも
**「相場より高い／安い」といった根拠のない市場比較を行いません。**
単価の妥当性については「社内の標準単価と比較してください」という確認を促す表現に留めています。

---

## ライセンス表記

`src/server/pdf/fonts/` の Noto Sans JP は SIL Open Font License 1.1 に基づき同梱しています
（`src/server/pdf/fonts/OFL.txt`）。
