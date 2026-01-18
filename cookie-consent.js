// ================================================
// COOKIE CONSENT - Çerez Bildirimi
// GDPR/KVKK Uyumlu
// ================================================

(function () {
    // Daha önce kabul edilmiş mi kontrol et
    if (localStorage.getItem('cookieConsent') === 'accepted') {
        return;
    }

    // Cookie banner HTML
    const bannerHTML = `
        <div id="cookieConsent" style="
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: linear-gradient(135deg, rgba(10, 10, 18, 0.98), rgba(20, 20, 35, 0.98));
            border-top: 1px solid rgba(0, 240, 255, 0.3);
            padding: 16px 20px;
            z-index: 10000;
            backdrop-filter: blur(10px);
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            justify-content: center;
            gap: 16px;
            font-family: 'Inter', sans-serif;
            font-size: 14px;
            color: #e0e0e0;
            box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.3);
        ">
            <div style="flex: 1; min-width: 280px; max-width: 700px;">
                <span style="margin-right: 8px;">🍪</span>
                Bu site, deneyiminizi iyileştirmek ve reklam göstermek için çerezler kullanmaktadır.
                Siteyi kullanmaya devam ederek çerez politikamızı kabul etmiş olursunuz.
                <a href="gizlilik.html" style="color: #00f0ff; text-decoration: none; margin-left: 4px;">
                    Daha fazla bilgi
                </a>
            </div>
            <div style="display: flex; gap: 12px;">
                <button id="cookieAccept" style="
                    padding: 10px 24px;
                    background: linear-gradient(135deg, #ff2d95, #a855f7);
                    border: none;
                    border-radius: 8px;
                    color: white;
                    font-weight: 600;
                    cursor: pointer;
                    font-size: 14px;
                    transition: transform 0.2s, box-shadow 0.2s;
                ">
                    Kabul Et
                </button>
                <button id="cookieReject" style="
                    padding: 10px 24px;
                    background: transparent;
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    border-radius: 8px;
                    color: #a0a0a0;
                    font-weight: 500;
                    cursor: pointer;
                    font-size: 14px;
                    transition: all 0.2s;
                ">
                    Sadece Gerekli
                </button>
            </div>
        </div>
    `;

    // Banner'ı sayfaya ekle
    document.body.insertAdjacentHTML('beforeend', bannerHTML);

    // Kabul butonu
    document.getElementById('cookieAccept').addEventListener('click', function () {
        localStorage.setItem('cookieConsent', 'accepted');
        localStorage.setItem('cookieConsentDate', new Date().toISOString());
        document.getElementById('cookieConsent').remove();

        // Google Analytics veya AdSense için consent mode
        if (typeof gtag === 'function') {
            gtag('consent', 'update', {
                'analytics_storage': 'granted',
                'ad_storage': 'granted'
            });
        }
    });

    // Reddet/Sadece Gerekli butonu
    document.getElementById('cookieReject').addEventListener('click', function () {
        localStorage.setItem('cookieConsent', 'rejected');
        localStorage.setItem('cookieConsentDate', new Date().toISOString());
        document.getElementById('cookieConsent').remove();

        // Consent mode - sadece gerekli
        if (typeof gtag === 'function') {
            gtag('consent', 'update', {
                'analytics_storage': 'denied',
                'ad_storage': 'denied'
            });
        }
    });

    // Hover efektleri
    const acceptBtn = document.getElementById('cookieAccept');
    const rejectBtn = document.getElementById('cookieReject');

    acceptBtn.addEventListener('mouseenter', function () {
        this.style.transform = 'translateY(-2px)';
        this.style.boxShadow = '0 4px 15px rgba(255, 45, 149, 0.4)';
    });

    acceptBtn.addEventListener('mouseleave', function () {
        this.style.transform = 'translateY(0)';
        this.style.boxShadow = 'none';
    });

    rejectBtn.addEventListener('mouseenter', function () {
        this.style.borderColor = 'rgba(255, 255, 255, 0.4)';
        this.style.color = '#ffffff';
    });

    rejectBtn.addEventListener('mouseleave', function () {
        this.style.borderColor = 'rgba(255, 255, 255, 0.2)';
        this.style.color = '#a0a0a0';
    });
})();
