import { useState } from 'react';
import { Save } from 'lucide-react';
import type { AppData, UserProfile } from '../types';
import { printHTMLReport, generateTextReport } from '../utils/reportGenerator';

interface Props {
  data: AppData;
  onChange: (data: AppData) => void;
}

const PREFECTURES = [
  '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
  '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
  '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
  '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県',
];

export default function Settings({ data, onChange }: Props) {
  const [profile, setProfile] = useState<UserProfile>({ ...data.settings.userProfile });
  const [usdJpyRate, setUsdJpyRate] = useState(data.settings.usdJpyRate);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    onChange({
      ...data,
      settings: {
        ...data.settings,
        userProfile: profile,
        usdJpyRate: usdJpyRate,
      },
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-800">設定</h1>

      {/* User Profile */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">👤 ユーザープロフィール</h2>
        <p className="text-xs text-gray-400 mb-4">
          ふるさと納税の上限計算に使用されます
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">お名前</label>
            <input
              type="text"
              className="input-field"
              value={profile.name}
              onChange={e => setProfile({ ...profile, name: e.target.value })}
              placeholder="山田 太郎"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">年齢</label>
            <input
              type="number"
              className="input-field"
              value={profile.age || ''}
              onChange={e => setProfile({ ...profile, age: Number(e.target.value) })}
              min="18" max="99"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">居住都道府県</label>
            <select
              className="input-field"
              value={profile.prefecture}
              onChange={e => setProfile({ ...profile, prefecture: e.target.value })}
            >
              {PREFECTURES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">配偶者</label>
            <select
              className="input-field"
              value={profile.hasSpouse ? '1' : '0'}
              onChange={e => setProfile({ ...profile, hasSpouse: e.target.value === '1' })}
            >
              <option value="0">なし</option>
              <option value="1">あり（控除対象）</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">扶養家族数（配偶者除く）</label>
            <input
              type="number"
              className="input-field"
              value={profile.dependentCount || ''}
              onChange={e => setProfile({ ...profile, dependentCount: Number(e.target.value) })}
              min="0" max="10"
              placeholder="0"
            />
          </div>
        </div>

        <h3 className="text-xs font-semibold text-gray-600 mt-5 mb-3">所得控除（年間）</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">生命保険料控除</label>
            <input
              type="number"
              className="input-field"
              value={profile.lifeInsuranceDeduction || ''}
              onChange={e => setProfile({ ...profile, lifeInsuranceDeduction: Number(e.target.value) })}
              placeholder="¥0"
            />
            <p className="text-xs text-gray-400 mt-0.5">上限: 120,000円</p>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">地震保険料控除</label>
            <input
              type="number"
              className="input-field"
              value={profile.earthquakeInsuranceDeduction || ''}
              onChange={e => setProfile({ ...profile, earthquakeInsuranceDeduction: Number(e.target.value) })}
              placeholder="¥0"
            />
            <p className="text-xs text-gray-400 mt-0.5">上限: 50,000円</p>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">その他控除</label>
            <input
              type="number"
              className="input-field"
              value={profile.otherDeductions || ''}
              onChange={e => setProfile({ ...profile, otherDeductions: Number(e.target.value) })}
              placeholder="¥0"
            />
            <p className="text-xs text-gray-400 mt-0.5">医療費控除等</p>
          </div>
        </div>
      </div>

      {/* Other Settings */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">⚙️ その他の設定</h2>
        <div className="max-w-xs">
          <label className="text-xs text-gray-500 mb-1 block">ドル円レート（米国株評価額計算用）</label>
          <div className="relative">
            <input
              type="number"
              className="input-field pr-10"
              value={usdJpyRate || ''}
              onChange={e => setUsdJpyRate(Number(e.target.value))}
              placeholder="150"
              min="50" max="300"
            />
            <span className="absolute right-3 top-2.5 text-gray-400 text-sm">円</span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">現在のレートを入力してください</p>
        </div>
      </div>

      {/* Report Export */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-1">📊 レポート出力</h2>
        <p className="text-xs text-gray-400 mb-4">資産・収入・投資・支出をまとめたレポートを出力します</p>
        <div className="flex flex-wrap gap-3">
          <button
            className="btn-primary text-sm"
            onClick={() => printHTMLReport(data)}
          >
            🖨️ PDFとして保存
          </button>
          <button
            className="btn-secondary text-sm"
            onClick={() => {
              const text = generateTextReport(data);
              const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `資産管理レポート_${new Date().toISOString().slice(0, 10)}.txt`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            📄 テキストでダウンロード
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          PDF: ブラウザの印刷画面が開きます。「PDFに保存」を選択してください。
        </p>
      </div>

      {/* Data Management */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">💾 データ管理</h2>
        <div className="flex flex-wrap gap-3">
          <button
            className="btn-secondary text-sm"
            onClick={() => {
              const json = JSON.stringify(data, null, 2);
              const blob = new Blob([json], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `asset-manager-backup-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            📥 データをエクスポート
          </button>
          <label className="btn-secondary text-sm cursor-pointer">
            📤 データをインポート
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                  try {
                    const imported = JSON.parse(ev.target?.result as string);
                    if (confirm('現在のデータを上書きしますか？')) {
                      onChange(imported);
                    }
                  } catch {
                    alert('JSONファイルの読み込みに失敗しました');
                  }
                };
                reader.readAsText(file);
                e.target.value = '';
              }}
            />
          </label>
          <button
            className="btn-danger"
            onClick={() => {
              if (confirm('全データを削除しますか？この操作は取り消せません。')) {
                localStorage.removeItem('asset-manager-data');
                window.location.reload();
              }
            }}
          >
            🗑️ 全データ削除
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          データはブラウザのローカルストレージに保存されています。定期的にエクスポートしてバックアップすることをお勧めします。
        </p>
      </div>

      <button
        onClick={handleSave}
        className={`w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
          saved
            ? 'bg-emerald-500 text-white'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
      >
        <Save size={16} />
        {saved ? '✓ 保存しました' : '設定を保存'}
      </button>
    </div>
  );
}
