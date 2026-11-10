import Link from 'next/link';

export const metadata = {title: 'Yardım ve ilk adımlar'};

export default function Page() {
  return <article className="container prose">
    <span className="eyebrow">İLK RAPORUNUZA GİDEN YOL</span>
    <h1>Bir PDF ile başlayın.</h1>
    <h2>1. Teknik resminizi yükleyin</h2>
    <p>Ana sayfadaki alana en fazla 15 MB bir PDF bırakın veya dosya seçin. Yalnızca ilk sayfa işlenir. Elinizde dosya yoksa örnek çizimle başlayabilirsiniz.</p>
    <h2>2. Kontrol noktalarını inceleyin</h2>
    <p>Okunabilen ölçülerden bir kontrol planı taslağı hazırlanır. Çizimdeki numaralara veya plan satırlarına dokunarak ölçüyü, birimi ve toleransı inceleyin; gerekirse düzenleyin. Demoda ayrıca nokta onayı vermeniz gerekmez. Eksik toleranslar uydurulmaz.</p>
    <h2>3. İlk beş noktayı ölçün</h2>
    <p>En fazla beş noktada ölçüm değerinizi girin. Virgül veya nokta kullanabilirsiniz. Toleransı belirli ölçülerde sonuç sınırlarla karşılaştırılır. Daha az nokta bulunursa yalnızca bulunan noktalar ölçülür. Sonraki satırlar örnek değerlerle doldurulur ve raporda gerçek ölçümlerden ayrı gösterilir.</p>
    <h2>4. PDF raporunuzu indirin</h2>
    <p>Son ölçümü kaydettiğinizde PDF raporunuz otomatik hazırlanır. “PDF raporunu indir” bağlantısıyla Ritim Quality başlığı, parça ve müşteri bilgileri, numaralandırılmış çizim ve ölçüm sonuçlarını içeren raporu alabilirsiniz. Boş bırakılan başlık alanlarında açıkça belirtilen demo bilgileri kullanılır. Örnek değerler uygun/uygunsuz toplamlarına dahil edilmez. Sonuçları ayrıca CSV olarak indirebilirsiniz.</p>
    <h2>Çizim net okunmuyorsa</h2>
    <p>Metinden nokta bulunamazsa ilk sayfa tarayıcınızda OCR ile okunur. Ölçünün yanındaki özel tolerans önceliklidir. Çizimdeki birim ve genel tolerans notları da değerlendirilir. Okuma her çizimde eksiksiz olmayabilir; üretimde kullanmadan önce taslağı teknik resimle karşılaştırın. “İşaretleri gizle” ile çizimi balonlar olmadan inceleyebilirsiniz.</p>
    <p>Yapay zekâ bağlantısı etkin olduğunda, ilk sayfanın görüntüsü ve metni analiz hizmetine gönderilmeden önce izniniz istenir. Analiz başarısız olduğunda mevcut taslak korunur.</p>
    <h2>Ekibinizle kullanmaya başlayın</h2>
    <p>“Ücretsiz hesabımı oluştur” adımından uygulamanın kayıt ekranına geçebilirsiniz. Firma hesabınızda ürünlerinizi, kontrol planlarınızı ve ölçümlerinizi yönetirsiniz. Demo PDF’si ve kontrol planı hesabınıza otomatik aktarılmaz; sayfayı kapatmadan raporunuzu indirin.</p>
    <Link className="button button-primary" href="/#canli-demo">Anında deneyin →</Link>
  </article>;
}
