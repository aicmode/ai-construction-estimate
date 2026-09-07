/**
 * Demo data seeder.
 *
 * Safety design:
 *  - Runs only against a Supabase project you point it at explicitly, and
 *    refuses to run unless SEED_CONFIRM=yes is set for a non-local URL.
 *  - Signs in as a real user with the anon key, so every insert goes through
 *    the same Row Level Security policies the application uses. It cannot
 *    reach data outside that user's organization even if misconfigured.
 *  - Never deletes anything. Existing rows are left untouched; the script
 *    appends a clearly-labelled fictional data set.
 *  - Safe to re-run: if the demo set is already present in the organization the
 *    script reports that and exits without writing, so repeated runs cannot
 *    silently duplicate the data. SEED_ALLOW_DUPLICATE=yes overrides this.
 *
 * Usage:
 *   1. Create an account through the app (sign up), then
 *   2. set SEED_USER_EMAIL / SEED_USER_PASSWORD in .env.local, then
 *   3. npm run db:seed
 */
import { createClient } from "@supabase/supabase-js";

import type { Database, SaveEstimateItem } from "../src/lib/database.types";
import { calcEstimate } from "../src/lib/estimate/calc";
import type { EstimateStatus, ItemCategory, UnitType, WorkType } from "../src/lib/domain";

const DEMO_MARKER = "※ポートフォリオ用デモデータ（架空）";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`環境変数 ${name} が設定されていません。`);
    process.exit(1);
  }
  return value;
}

interface SeedItem {
  name: string;
  category: ItemCategory;
  description: string;
  quantity: number;
  unit: UnitType;
  unitPrice: number;
  unitCost: number;
}

interface SeedEstimate {
  title: string;
  status: EstimateStatus;
  issueOffsetDays: number;
  validityDays: number;
  taxRate: number;
  discountAmount: number;
  paymentTerms: string;
  notes: string;
  items: SeedItem[];
}

interface SeedProject {
  name: string;
  workType: WorkType;
  siteAddress: string;
  description: string;
  managerName: string;
  status: Database["public"]["Tables"]["projects"]["Row"]["status"];
  startOffsetDays: number;
  endOffsetDays: number;
  estimates: SeedEstimate[];
}

interface SeedCustomer {
  name: string;
  companyName: string;
  contactName: string;
  phone: string;
  email: string;
  postalCode: string;
  address: string;
  projects: SeedProject[];
}

/**
 * All names, addresses, phone numbers and email addresses below are invented.
 * Phone numbers use the 03-0000-xxxx range and addresses use 0-0-0 block
 * numbers so they cannot match a real person or company.
 */
const CUSTOMERS: SeedCustomer[] = [
  {
    name: "架空 太郎",
    companyName: "",
    contactName: "架空 太郎",
    phone: "090-0000-0011",
    email: "taro.kakuu@example.com",
    postalCode: "150-0002",
    address: "東京都渋谷区渋谷0-0-0 サンプルレジデンス101（架空住所）",
    projects: [
      {
        name: "渋谷区 戸建てキッチン改修",
        workType: "reform",
        siteAddress: "東京都渋谷区神南0-0-0（架空住所）",
        description: "既存システムキッチンの解体・撤去、新規キッチン設置、内装補修一式。",
        managerName: "現場 一郎",
        status: "estimating",
        startOffsetDays: 21,
        endOffsetDays: 35,
        estimates: [
          {
            title: "戸建てキッチン改修工事一式",
            status: "SUBMITTED",
            issueOffsetDays: -6,
            validityDays: 30,
            taxRate: 10,
            discountAmount: 32_700,
            paymentTerms: "着手時50%・完了引渡時50%（各請求書発行後30日以内のお振込み）",
            notes: `本見積は現地調査時点の内容に基づくものです。\n解体後に下地の腐食等が判明した場合は別途お見積りとなります。\n${DEMO_MARKER}`,
            items: [
              { name: "既存キッチン撤去・処分", category: "demolition", description: "既存システムキッチン（Ⅰ型2550㎜）の解体・搬出・産廃処分費を含む", quantity: 1, unit: "set", unitPrice: 128_000, unitCost: 86_000 },
              { name: "システムキッチン本体（Ⅰ型・幅2550㎜・食洗機付）", category: "equipment", description: "人造大理石ワークトップ／扉カラーは別途お打合せ", quantity: 1, unit: "unit", unitPrice: 812_000, unitCost: 568_400 },
              { name: "給排水設備工事", category: "plumbing", description: "給水・給湯・排水配管の切回し及び接続", quantity: 1, unit: "set", unitPrice: 96_000, unitCost: 62_000 },
              { name: "電気設備工事（専用回路増設）", category: "electrical", description: "食洗機・IH用専用回路2系統、分電盤ブレーカー増設を含む", quantity: 2, unit: "piece", unitPrice: 32_000, unitCost: 19_500 },
              { name: "キッチンパネル張替", category: "interior_finish", description: "不燃メラミン化粧板", quantity: 8.5, unit: "sqm", unitPrice: 12_800, unitCost: 8_200 },
              { name: "床クッションフロア張替", category: "interior_finish", description: "", quantity: 6.75, unit: "sqm", unitPrice: 6_800, unitCost: 4_100 },
              { name: "現場管理費・諸経費", category: "management", description: "近隣挨拶・養生・清掃・廃材運搬を含む", quantity: 1, unit: "set", unitPrice: 78_000, unitCost: 24_000 },
            ],
          },
        ],
      },
      {
        name: "渋谷区 浴室リフォーム",
        workType: "plumbing",
        siteAddress: "東京都渋谷区神南0-0-0（架空住所）",
        description: "在来浴室からユニットバスへの入替。土間解体・配管更新を含む。",
        managerName: "現場 一郎",
        status: "planning",
        startOffsetDays: 60,
        endOffsetDays: 74,
        estimates: [
          {
            title: "浴室ユニットバス入替工事",
            status: "DRAFT",
            issueOffsetDays: -1,
            validityDays: 30,
            taxRate: 10,
            discountAmount: 0,
            paymentTerms: "",
            notes: `在来浴室の解体後に土間の状況を確認のうえ、追加工事の要否をご相談します。\n${DEMO_MARKER}`,
            items: [
              { name: "在来浴室解体・土間斫り", category: "demolition", description: "タイル・モルタル・土間コンクリートの解体および処分", quantity: 1, unit: "set", unitPrice: 218_000, unitCost: 168_000 },
              { name: "ユニットバス本体（1616サイズ・断熱仕様）", category: "equipment", description: "浴室暖房乾燥機付", quantity: 1, unit: "unit", unitPrice: 745_000, unitCost: 612_000 },
              { name: "ユニットバス組立設置", category: "equipment", description: "", quantity: 1, unit: "set", unitPrice: 138_000, unitCost: 98_000 },
              { name: "給排水配管更新", category: "plumbing", description: "給湯配管の更新を含む", quantity: 1, unit: "set", unitPrice: 124_000, unitCost: 86_000 },
              { name: "電気配線工事", category: "electrical", description: "浴室暖房乾燥機用専用回路", quantity: 1, unit: "set", unitPrice: 58_000, unitCost: 39_000 },
              { name: "廃材処分費", category: "waste_disposal", description: "混合廃棄物", quantity: 2.5, unit: "cbm", unitPrice: 22_000, unitCost: 18_500 },
            ],
          },
        ],
      },
    ],
  },
  {
    name: "サンプル不動産管理株式会社",
    companyName: "サンプル不動産管理株式会社",
    contactName: "管理部 見本 花子",
    phone: "03-0000-0022",
    email: "kanri@example.com",
    postalCode: "141-0001",
    address: "東京都品川区北品川0-0-0 サンプルビル8階（架空住所）",
    projects: [
      {
        name: "品川区 賃貸アパート外壁塗装",
        workType: "painting",
        siteAddress: "東京都品川区大井0-0-0（架空住所）",
        description: "木造2階建アパート（8戸）の外壁・屋根塗装および防水改修。",
        managerName: "塗装 次郎",
        status: "contracted",
        startOffsetDays: -20,
        endOffsetDays: 10,
        estimates: [
          {
            title: "アパート外壁塗装・防水改修工事",
            status: "ACCEPTED",
            issueOffsetDays: -48,
            validityDays: 45,
            taxRate: 10,
            discountAmount: 180_000,
            paymentTerms: "契約時30%・中間30%・完了時40%",
            notes: `足場設置期間中は駐輪場の一部が使用できません。\n${DEMO_MARKER}`,
            items: [
              { name: "仮設足場設置・解体", category: "scaffolding", description: "メッシュシート養生を含む", quantity: 486, unit: "sqm", unitPrice: 1_150, unitCost: 780 },
              { name: "高圧洗浄", category: "exterior_finish", description: "外壁・屋根・付帯部", quantity: 486, unit: "sqm", unitPrice: 280, unitCost: 165 },
              { name: "下地補修（シーリング打替）", category: "waterproofing", description: "変成シリコン系", quantity: 320, unit: "m", unitPrice: 1_050, unitCost: 640 },
              { name: "外壁シリコン塗装（3回塗り）", category: "painting", description: "下塗り・中塗り・上塗り", quantity: 386, unit: "sqm", unitPrice: 3_200, unitCost: 1_980 },
              { name: "屋根遮熱塗装（3回塗り）", category: "painting", description: "", quantity: 142, unit: "sqm", unitPrice: 3_600, unitCost: 2_240 },
              { name: "付帯部塗装（雨樋・破風・鉄部）", category: "painting", description: "", quantity: 1, unit: "set", unitPrice: 268_000, unitCost: 164_000 },
              { name: "バルコニー防水（ウレタン塗膜）", category: "waterproofing", description: "8戸分", quantity: 64, unit: "sqm", unitPrice: 6_800, unitCost: 4_300 },
              { name: "現場管理費・諸経費", category: "management", description: "近隣挨拶・仮設トイレ・清掃を含む", quantity: 1, unit: "set", unitPrice: 320_000, unitCost: 118_000 },
            ],
          },
        ],
      },
      {
        name: "品川区 空室原状回復（201号室）",
        workType: "interior",
        siteAddress: "東京都品川区大井0-0-0 201号室（架空住所）",
        description: "退去後の原状回復。クロス張替、床材張替、ハウスクリーニング。",
        managerName: "内装 三郎",
        status: "completed",
        startOffsetDays: -90,
        endOffsetDays: -80,
        estimates: [
          {
            title: "201号室 原状回復工事",
            status: "ACCEPTED",
            issueOffsetDays: -100,
            validityDays: 30,
            taxRate: 10,
            discountAmount: 0,
            paymentTerms: "完了後翌月末払い",
            notes: `${DEMO_MARKER}`,
            items: [
              { name: "クロス張替（量産品）", category: "interior_finish", description: "既存剥がし・下地処理を含む", quantity: 168, unit: "sqm", unitPrice: 1_280, unitCost: 780 },
              { name: "クッションフロア張替", category: "interior_finish", description: "洗面・トイレ", quantity: 8.4, unit: "sqm", unitPrice: 4_800, unitCost: 2_950 },
              { name: "ハウスクリーニング", category: "other", description: "エアコン内部洗浄を含む", quantity: 1, unit: "set", unitPrice: 68_000, unitCost: 42_000 },
              { name: "建具調整・部品交換", category: "carpentry", description: "", quantity: 1, unit: "set", unitPrice: 24_000, unitCost: 13_500 },
            ],
          },
        ],
      },
    ],
  },
  {
    name: "カフェ・サンプルテラス",
    companyName: "株式会社サンプルフードサービス",
    contactName: "店舗開発 例示 三郎",
    phone: "03-0000-0033",
    email: "tempo@example.com",
    postalCode: "160-0022",
    address: "東京都新宿区新宿0-0-0 サンプルビル1階（架空住所）",
    projects: [
      {
        name: "新宿区 カフェ店舗内装工事",
        workType: "interior",
        siteAddress: "東京都新宿区新宿0-0-0 1階（架空住所）",
        description: "スケルトン物件へのカフェ内装。厨房設備・客席造作・電気設備一式。",
        managerName: "内装 三郎",
        status: "estimating",
        startOffsetDays: 30,
        endOffsetDays: 75,
        estimates: [
          {
            title: "カフェ店舗内装工事一式（A案）",
            status: "REVIEW",
            issueOffsetDays: -3,
            validityDays: 21,
            taxRate: 10,
            discountAmount: 0,
            paymentTerms: "契約時40%・完了時60%",
            notes: `消防・保健所への届出は別途お客様手配となります。\n${DEMO_MARKER}`,
            items: [
              { name: "仮設工事（養生・仮設電気）", category: "temporary_works", description: "", quantity: 1, unit: "set", unitPrice: 184_000, unitCost: 128_000 },
              { name: "軽量鉄骨下地・石膏ボード", category: "carpentry", description: "間仕切壁・天井下地", quantity: 132, unit: "sqm", unitPrice: 7_400, unitCost: 4_950 },
              { name: "内装仕上（塗装・クロス）", category: "interior_finish", description: "客席・バックヤード", quantity: 132, unit: "sqm", unitPrice: 4_800, unitCost: 3_150 },
              { name: "床仕上（モルタル金鏝＋塗床）", category: "interior_finish", description: "", quantity: 58, unit: "sqm", unitPrice: 9_600, unitCost: 6_400 },
              { name: "厨房設備工事", category: "equipment", description: "シンク・給排気フード・グリストラップ", quantity: 1, unit: "set", unitPrice: 1_480_000, unitCost: 1_120_000 },
              { name: "電気設備工事", category: "electrical", description: "動力・照明・コンセント一式", quantity: 1, unit: "set", unitPrice: 862_000, unitCost: 598_000 },
              { name: "空調設備工事", category: "equipment", description: "業務用エアコン2台設置", quantity: 2, unit: "unit", unitPrice: 428_000, unitCost: 318_000 },
              { name: "造作家具（カウンター・ベンチ）", category: "carpentry", description: "オーダー造作", quantity: 1, unit: "set", unitPrice: 620_000, unitCost: 445_000 },
              { name: "設計・申請費", category: "design", description: "実施設計図面作成", quantity: 1, unit: "set", unitPrice: 280_000, unitCost: 96_000 },
              { name: "現場管理費・諸経費", category: "management", description: "", quantity: 1, unit: "set", unitPrice: 480_000, unitCost: 186_000 },
            ],
          },
        ],
      },
    ],
  },
  {
    name: "サンプル商事株式会社",
    companyName: "サンプル商事株式会社",
    contactName: "総務部 例 四郎",
    phone: "03-0000-0044",
    email: "soumu@example.com",
    postalCode: "104-0061",
    address: "東京都中央区銀座0-0-0 サンプル銀座ビル5階（架空住所）",
    projects: [
      {
        name: "中央区 事務所エアコン設備更新",
        workType: "equipment",
        siteAddress: "東京都中央区銀座0-0-0 5階（架空住所）",
        description: "事務所フロアの業務用エアコン6台の入替。既存機撤去・処分を含む。",
        managerName: "設備 四郎",
        status: "estimating",
        startOffsetDays: 14,
        endOffsetDays: 18,
        estimates: [
          {
            title: "事務所エアコン設備更新工事",
            status: "SUBMITTED",
            issueOffsetDays: -12,
            validityDays: 14,
            taxRate: 10,
            discountAmount: 96_000,
            paymentTerms: "完了後翌月末払い",
            notes: `作業は土日または平日夜間を想定しています。\n${DEMO_MARKER}`,
            items: [
              { name: "既存エアコン撤去・処分", category: "demolition", description: "フロン回収作業を含む", quantity: 6, unit: "unit", unitPrice: 42_000, unitCost: 31_000 },
              { name: "業務用エアコン本体（天井カセット4方向 5馬力）", category: "equipment", description: "省エネ機種", quantity: 6, unit: "unit", unitPrice: 486_000, unitCost: 402_000 },
              { name: "据付・冷媒配管工事", category: "equipment", description: "既存配管流用不可のため新設", quantity: 6, unit: "unit", unitPrice: 128_000, unitCost: 92_000 },
              { name: "電気配線工事", category: "electrical", description: "動力盤からの配線更新", quantity: 1, unit: "set", unitPrice: 268_000, unitCost: 178_000 },
              { name: "天井補修", category: "interior_finish", description: "システム天井の部分補修", quantity: 1, unit: "set", unitPrice: 96_000, unitCost: 58_000 },
              { name: "夜間・休日作業割増", category: "management", description: "", quantity: 1, unit: "set", unitPrice: 180_000, unitCost: 140_000 },
            ],
          },
          {
            title: "事務所エアコン設備更新工事（簡易更新案）",
            status: "REJECTED",
            issueOffsetDays: -30,
            validityDays: 14,
            taxRate: 10,
            discountAmount: 0,
            paymentTerms: "完了後翌月末払い",
            notes: `既存配管流用案。お客様のご要望により配管新設案へ変更となりました。\n${DEMO_MARKER}`,
            items: [
              { name: "既存エアコン撤去・処分", category: "demolition", description: "", quantity: 6, unit: "unit", unitPrice: 42_000, unitCost: 31_000 },
              { name: "業務用エアコン本体（天井カセット4方向 5馬力）", category: "equipment", description: "標準機種", quantity: 6, unit: "unit", unitPrice: 398_000, unitCost: 356_000 },
              { name: "据付工事（既存配管流用）", category: "equipment", description: "", quantity: 6, unit: "unit", unitPrice: 58_000, unitCost: 52_000 },
            ],
          },
        ],
      },
    ],
  },
];

function isoDate(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function main() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const email = requireEnv("SEED_USER_EMAIL");
  const password = requireEnv("SEED_USER_PASSWORD");

  const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost)/u.test(url);
  if (!isLocal && process.env.SEED_CONFIRM !== "yes") {
    console.error(
      [
        "リモートのSupabaseプロジェクトに対してseedを実行しようとしています。",
        `  URL: ${url}`,
        "本番データに追記したくない場合は中止してください。",
        "実行する場合は SEED_CONFIRM=yes を指定してください。",
      ].join("\n"),
    );
    process.exit(1);
  }

  const supabase = createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (authError || !auth.user) {
    console.error("ログインに失敗しました。先にアプリからアカウントを作成してください。");
    process.exit(1);
  }
  console.log(`ログイン成功: ${auth.user.email}`);

  const { data: memberships, error: membershipError } = await supabase
    .from("organization_members")
    .select("organization_id")
    .order("created_at", { ascending: true })
    .limit(1);

  if (membershipError || !memberships || memberships.length === 0) {
    console.error("組織が見つかりません。先にアプリで組織を作成してください。");
    process.exit(1);
  }
  const organizationId = memberships[0].organization_id;
  console.log(`対象組織: ${organizationId}`);

  // --- re-run guard --------------------------------------------------------
  // Every seeded customer carries DEMO_MARKER in `notes`. If any are already
  // present the demo set has been loaded before, and inserting it again would
  // silently duplicate all customers/projects/estimates. Re-seeding therefore
  // has to be requested explicitly with SEED_ALLOW_DUPLICATE=yes.
  const { count: existingDemoCount, error: existingError } = await supabase
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("notes", DEMO_MARKER);

  if (existingError) {
    console.error(`既存デモデータの確認に失敗しました: ${existingError.message}`);
    process.exit(1);
  }

  if ((existingDemoCount ?? 0) > 0 && process.env.SEED_ALLOW_DUPLICATE !== "yes") {
    console.log(
      [
        `この組織には既にデモデータが ${existingDemoCount} 件登録されています。`,
        "重複登録を避けるため、seedをスキップしました。",
        "",
        "・そのまま利用する場合: 何もする必要はありません。",
        "・あえてもう一組追加する場合: SEED_ALLOW_DUPLICATE=yes を指定してください。",
        "・入れ直す場合: 先にアプリ上で既存のデモデータを削除してください。",
      ].join("\n"),
    );
    process.exit(0);
  }

  let customerCount = 0;
  let projectCount = 0;
  let estimateCount = 0;

  for (const seedCustomer of CUSTOMERS) {
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .insert({
        organization_id: organizationId,
        name: seedCustomer.name,
        company_name: seedCustomer.companyName,
        contact_name: seedCustomer.contactName,
        phone: seedCustomer.phone,
        email: seedCustomer.email,
        postal_code: seedCustomer.postalCode,
        address: seedCustomer.address,
        notes: DEMO_MARKER,
        created_by: auth.user.id,
      })
      .select("id")
      .single();

    if (customerError || !customer) {
      console.error(`顧客の作成に失敗しました: ${customerError?.message}`);
      process.exit(1);
    }
    customerCount += 1;

    for (const seedProject of seedCustomer.projects) {
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .insert({
          organization_id: organizationId,
          customer_id: customer.id,
          name: seedProject.name,
          work_type: seedProject.workType,
          site_address: seedProject.siteAddress,
          description: seedProject.description,
          scheduled_start_date: isoDate(seedProject.startOffsetDays),
          scheduled_end_date: isoDate(seedProject.endOffsetDays),
          manager_name: seedProject.managerName,
          status: seedProject.status,
          notes: DEMO_MARKER,
          created_by: auth.user.id,
        })
        .select("id")
        .single();

      if (projectError || !project) {
        console.error(`工事案件の作成に失敗しました: ${projectError?.message}`);
        process.exit(1);
      }
      projectCount += 1;

      for (const seedEstimate of seedProject.estimates) {
        const issueDate = isoDate(seedEstimate.issueOffsetDays);
        const validUntil = isoDate(seedEstimate.issueOffsetDays + seedEstimate.validityDays);

        // The same calculator the application uses — the seed can never write
        // totals that disagree with what the app would compute.
        const totals = calcEstimate({
          items: seedEstimate.items.map((item) => ({
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            unitCost: item.unitCost,
          })),
          taxRate: seedEstimate.taxRate,
          discountAmount: seedEstimate.discountAmount,
        });

        const items: SaveEstimateItem[] = seedEstimate.items.map((item, index) => ({
          name: item.name,
          category: item.category,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unit_price: item.unitPrice,
          unit_cost: item.unitCost,
          amount: totals.items[index].amount,
          cost_amount: totals.items[index].costAmount,
        }));

        const { data: estimateNumber, error: numberError } = await supabase.rpc(
          "next_estimate_number",
          { p_org: organizationId, p_year: Number(issueDate.slice(0, 4)) },
        );
        if (numberError || !estimateNumber) {
          console.error(`見積番号の採番に失敗しました: ${numberError?.message}`);
          process.exit(1);
        }

        const { error: saveError } = await supabase.rpc("save_estimate", {
          p_org: organizationId,
          p_estimate_id: null,
          p_customer_id: customer.id,
          p_project_id: project.id,
          p_estimate_number: estimateNumber,
          p_title: seedEstimate.title,
          p_issue_date: issueDate,
          p_valid_until: validUntil,
          p_status: seedEstimate.status,
          p_payment_terms: seedEstimate.paymentTerms,
          p_notes: seedEstimate.notes,
          p_tax_rate: seedEstimate.taxRate,
          p_discount_amount: totals.discountAmount,
          p_items_subtotal: totals.itemsSubtotal,
          p_subtotal_amount: totals.subtotalAmount,
          p_tax_amount: totals.taxAmount,
          p_total_amount: totals.totalAmount,
          p_cost_amount: totals.costAmount,
          p_gross_profit: totals.grossProfit,
          p_gross_margin_rate: totals.grossMarginRate,
          p_items: items,
        });

        if (saveError) {
          console.error(`見積の作成に失敗しました: ${saveError.message}`);
          process.exit(1);
        }
        estimateCount += 1;
        console.log(`  作成: ${estimateNumber} ${seedEstimate.title}`);
      }
    }
  }

  console.log(
    `\n完了しました。顧客 ${customerCount} 件 / 工事案件 ${projectCount} 件 / 見積 ${estimateCount} 件を追加しました。`,
  );
  console.log("すべて架空のデモデータです。備考欄に識別用のマーカーが入っています。");
}

void main();
