import {Button, Card, Field, Input, Modal, PageActions} from './ui';
import React, { useState } from 'react';
import { StorageService } from '../services/storage';
import { Download, RotateCcw, CheckCircle2, AlertTriangle } from 'lucide-react';

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
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    setStatusMessage({ type: 'success', text: 'Veriler dışa aktarıldı.' });
  };

  // Import JSON
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm('Bu tarayıcıdaki veriler yedekle değiştirilecek. Devam edilsin mi?')) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const success = StorageService.importData(content);
        if (success) {
          setStatusMessage({ type: 'success', text: 'Veritabanı yedeği başarıyla geri yüklendi!' });
          onDataRestored();
        } else {
          setStatusMessage({ type: 'error', text: 'Yedek dosyası okunamadı. Lütfen geçerli bir yedek seçin.' });
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

  return <Modal open title="Veri Yönetimi" onClose={onClose}>
    <div className="space-y-5">
      <p className="rq-helper">Ritim Cloud verilerinizi sunucuda saklar. Bu dışa aktarım, ekranda yüklenmiş ürün, plan ve ölçüm kayıtlarını içerir; tam sunucu yedeği değildir. Sunucu yedeklerini sistem yöneticiniz yönetir.</p>
      {statusMessage&&<p role={statusMessage.type==='error'?'alert':'status'} className={'rq-feedback rq-tone-'+(statusMessage.type==='success'?'success':'danger')}>{statusMessage.type==='success'?<CheckCircle2 size={18}/>:<AlertTriangle size={18}/>}<span>{statusMessage.text}</span></p>}
      <Card><h3 className="rq-section-title">Verileri dışa aktar</h3><p className="rq-helper">Yüklenmiş ürünler, kontrol planları ve ölçüm kayıtları · JSON</p><Button variant="primary" onClick={handleExportJSON}><Download size={16}/>Yedek Al</Button></Card>
      {import.meta.env.DEV&&!StorageService.getCompany().id&&<section className="rq-danger-zone"><h3 className="rq-section-title">Veri değiştirme işlemleri</h3><p className="rq-helper">Geri yükleme ve sıfırlama mevcut yerel kayıtları değiştirir. İşlem öncesinde yedeğinizi dışa aktarın.</p>
        <Field label="Yedekten geri yükle" hint="Daha önce indirdiğiniz JSON yedeğini seçin."><Input type="file" accept=".json" onChange={handleImportFile}/></Field>
        <div className="mt-5"><h4 className="rq-section-title">Fabrika demo verilerine sıfırla</h4><p className="rq-helper">Mevcut kayıtların yerine örnek ürünler, kontrol planları ve ölçümler yüklenir.</p><Button variant="danger" onClick={handleResetDemo}><RotateCcw size={16}/>Sıfırla</Button></div>
      </section>}
      <PageActions><Button onClick={onClose}>Kapat</Button></PageActions>
    </div>
  </Modal>;
};
