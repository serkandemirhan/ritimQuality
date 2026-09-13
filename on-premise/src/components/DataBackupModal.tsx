import React, { useState } from 'react';
import { StorageService } from '../services/storage';
import { Download, Upload, RotateCcw, X, CheckCircle2, AlertTriangle, Database } from 'lucide-react';

interface DataBackupModalProps {
  onClose: () => void;
  onDataRestored: () => void;
}

export const DataBackupModal: React.FC<DataBackupModalProps> = ({
  onClose,
  onDataRestored,
}) => {
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Export JSON
  const handleExportJSON = () => {
    const jsonStr = StorageService.exportAllData();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Ritim_Quality_Yedek_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setStatusMessage({ type: 'success', text: 'Tüm veritabanı yedeği JSON dosyası olarak indirildi.' });
  };

  // Import JSON
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const success = StorageService.importData(content);
        if (success) {
          setStatusMessage({ type: 'success', text: 'Veritabanı yedeği başarıyla geri yüklendi!' });
          onDataRestored();
        } else {
          setStatusMessage({ type: 'error', text: 'Geçersiz JSON dosyası! Lütfen doğru formatta yedek seçin.' });
        }
      }
    };
    reader.readAsText(file);
  };

  // Reset to Demo
  const handleResetDemo = () => {
    if (confirm('Tüm mevcut veriler silinecek ve fabrika varsayılan örnek parçalar, kontrol planları ve ölçümler yüklenecek. Emin misiniz?')) {
      StorageService.resetToDemo();
      setStatusMessage({ type: 'success', text: 'Örnek endüstriyel veriler başarıyla yüklendi!' });
      onDataRestored();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h3 className="font-bold text-slate-900 text-base flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center">
              <Database className="w-4 h-4" />
            </span>
            Lokal Veritabanı & Yedekleme Yönetimi
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center font-bold"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed font-medium">
          Bu uygulama KOBİ ve imalat atölyeleri için tamamen yerel çalışır. Verilerinizi JSON formatında dışa aktarabilir, başka bilgisayarlara taşıyabilir veya fabrika demo verilerini yeniden yükleyebilirsiniz.
        </p>

        {statusMessage && (
          <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}>
            {statusMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}
            <span>{statusMessage.text}</span>
          </div>
        )}

        <div className="space-y-3 pt-2">
          {/* Backup Export */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-slate-900">Veritabanı Yedeği İndir (JSON)</div>
              <div className="text-[11px] text-slate-500 font-medium">Tüm ürünler, kontrol planları ve ölçüm logları</div>
            </div>
            <button
              type="button"
              onClick={handleExportJSON}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-3 rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-blue-500/20 transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Yedek Al</span>
            </button>
          </div>

          {/* Backup Import */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-slate-900">Yedekten Geri Yükle</div>
              <div className="text-[11px] text-slate-500 font-medium">Daha önce alınmış bir .json dosyasını yükleyin</div>
            </div>
            <label className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-3 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-md shadow-indigo-500/20 transition">
              <Upload className="w-3.5 h-3.5" />
              <span>Dosya Seç</span>
              <input
                type="file"
                accept=".json"
                disabled={!import.meta.env.DEV} onChange={handleImportFile}
                className="hidden"
              />
            </label>
          </div>

          {/* Reset to Demo */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-rose-600">Fabrika Demo Verilerine Sıfırla</div>
              <div className="text-[11px] text-slate-500 font-medium">Örnek 3 parça, kontrol planları ve 30 ölçüm kaydı</div>
            </div>
            <button
              type="button"
              hidden={!import.meta.env.DEV} onClick={handleResetDemo}
              className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold py-2 px-3 rounded-xl text-xs flex items-center gap-1.5 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Sıfırla</span>
            </button>
          </div>
        </div>

        <div className="flex justify-end pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
