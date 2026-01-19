// ================================================
// KELİME OYUNU - TÜRKÇE KELİME LİSTESİ
// Her kelime: { word: string, taboo: string[] }
// ================================================

const WORD_LIST = [
    // YEMEKLER
    { word: "PIZZA", taboo: ["İtalyan", "Hamur", "Peynir", "Dilim", "Fırın"] },
    { word: "DÖNER", taboo: ["Et", "Ekmek", "Şiş", "Döndürmek", "Kebap"] },
    { word: "ÇORBA", taboo: ["Sıcak", "Kaşık", "Mercimek", "Tuz", "Hasta"] },
    { word: "LAHMACUN", taboo: ["Hamur", "Kıyma", "İnce", "Antep", "Limon"] },
    { word: "PASTA", taboo: ["Tatlı", "Doğum günü", "Krema", "Mum", "Dilim"] },
    { word: "SIMIT", taboo: ["Yuvarlak", "Susam", "Çay", "Fırın", "Kahvaltı"] },
    { word: "KÖFTE", taboo: ["Et", "Yuvarlak", "Izgara", "Kıyma", "Top"] },
    { word: "MAKARNA", taboo: ["İtalyan", "Spagetti", "Sos", "Haşlamak", "Erişte"] },

    // HAYVANLAR
    { word: "KÖPEK", taboo: ["Havlamak", "Kuyruk", "Evcil", "Tasma", "Sadık"] },
    { word: "KEDİ", taboo: ["Miyav", "Evcil", "Pati", "Tüy", "Fare"] },
    { word: "ASLAN", taboo: ["Kral", "Yele", "Afrika", "Kükreme", "Vahşi"] },
    { word: "FİL", taboo: ["Hortum", "Büyük", "Afrika", "Gri", "Hafıza"] },
    { word: "BALIK", taboo: ["Su", "Yüzmek", "Deniz", "Solungaç", "Olta"] },
    { word: "MAYMUN", taboo: ["Muz", "Ağaç", "Tırmanmak", "Hayvanat bahçesi", "Kuyruk"] },
    { word: "PENGUEN", taboo: ["Kutup", "Buz", "Siyah beyaz", "Uçamaz", "Soğuk"] },
    { word: "TAVUK", taboo: ["Yumurta", "Gıdak", "Kümes", "Piliç", "Kanat"] },

    // MEKANLAR
    { word: "HASTANE", taboo: ["Doktor", "Hasta", "Ameliyat", "Hemşire", "Tedavi"] },
    { word: "OKUL", taboo: ["Öğretmen", "Öğrenci", "Ders", "Sınıf", "Yazı tahtası"] },
    { word: "SİNEMA", taboo: ["Film", "Perde", "Bilet", "Patlamış mısır", "Salon"] },
    { word: "MARKET", taboo: ["Alışveriş", "Kasa", "Ürün", "Sepet", "Fiyat"] },
    { word: "HAVAALANI", taboo: ["Uçak", "Bagaj", "Pilot", "Kalkış", "İniş"] },
    { word: "KUAFÖR", taboo: ["Saç", "Kesmek", "Makas", "Fön", "Şekil"] },
    { word: "RESTORAN", taboo: ["Yemek", "Garson", "Menü", "Masa", "Sipariş"] },
    { word: "BANKA", taboo: ["Para", "Hesap", "Kredi", "ATM", "Faiz"] },

    // NESNELER
    { word: "TELEFON", taboo: ["Arama", "Mesaj", "Ekran", "Mobil", "Şarj"] },
    { word: "BİLGİSAYAR", taboo: ["Klavye", "Mouse", "Ekran", "İnternet", "Yazılım"] },
    { word: "TELEVİZYON", taboo: ["Kanal", "Kumanda", "Ekran", "İzlemek", "Program"] },
    { word: "BUZDOLABI", taboo: ["Soğuk", "Mutfak", "Yiyecek", "Buz", "Elektrik"] },
    { word: "ARABA", taboo: ["Motor", "Tekerlek", "Sürücü", "Benzin", "Yol"] },
    { word: "BİSİKLET", taboo: ["Pedal", "Tekerlek", "Zincir", "Sürmek", "İki"] },
    { word: "GÖZLÜK", taboo: ["Cam", "Göz", "Çerçeve", "Görmek", "Güneş"] },
    { word: "ŞEMSİYE", taboo: ["Yağmur", "Açmak", "Korumak", "Sap", "Islak"] },

    // SPOR
    { word: "FUTBOL", taboo: ["Top", "Gol", "Kale", "Hakem", "Maç"] },
    { word: "BASKETBOL", taboo: ["Pota", "Top", "Sayı", "Zıplamak", "NBA"] },
    { word: "TENİS", taboo: ["Raket", "Top", "Ağ", "Kort", "Servis"] },
    { word: "YÜZME", taboo: ["Su", "Havuz", "Mayo", "Kulaç", "Dalga"] },
    { word: "KOŞU", taboo: ["Ayak", "Hız", "Maraton", "Spor", "Pist"] },
    { word: "BOKS", taboo: ["Yumruk", "Eldiven", "Ring", "Nakavt", "Dövüş"] },
    { word: "KAYAK", taboo: ["Kar", "Dağ", "Kış", "Pist", "Soğuk"] },
    { word: "GÜREŞİ", taboo: ["Minder", "Tuş", "Güçlü", "Kırkpınar", "Pehlivan"] },

    // MESLEKLER
    { word: "DOKTOR", taboo: ["Hastane", "İlaç", "Tedavi", "Hasta", "Muayene"] },
    { word: "ÖĞRETMEN", taboo: ["Okul", "Ders", "Öğrenci", "Sınıf", "Eğitim"] },
    { word: "POLİS", taboo: ["Suç", "Tutuklamak", "Silah", "Devriye", "Hırsız"] },
    { word: "AŞÇI", taboo: ["Mutfak", "Yemek", "Pişirmek", "Restoran", "Tarif"] },
    { word: "PİLOT", taboo: ["Uçak", "Uçmak", "Kokpit", "Gökyüzü", "Kaptan"] },
    { word: "MİMAR", taboo: ["Bina", "Çizim", "Tasarım", "Proje", "Plan"] },
    { word: "AVUKAT", taboo: ["Mahkeme", "Dava", "Hukuk", "Savunma", "Hakim"] },
    { word: "FOTOĞRAFÇI", taboo: ["Kamera", "Resim", "Çekim", "Poz", "Albüm"] },

    // DUYGULAR & KAVRAMLAR
    { word: "AŞK", taboo: ["Sevgi", "Kalp", "Romantik", "Çift", "Evlilik"] },
    { word: "KORKU", taboo: ["Korkak", "Kabus", "Ürkmek", "Dehşet", "Panik"] },
    { word: "MUTLULUK", taboo: ["Sevinç", "Gülmek", "Neşe", "Pozitif", "Keyif"] },
    { word: "ÖZGÜRLÜK", taboo: ["Serbest", "Bağımsız", "Hapis", "Kuş", "Özgür"] },
    { word: "BAŞARI", taboo: ["Kazanmak", "Ödül", "Hedef", "Zafer", "Amaç"] },
    { word: "DOSTLUK", taboo: ["Arkadaş", "Sadık", "Güven", "Beraber", "Kanka"] },
    { word: "BARIŞI", taboo: ["Savaş", "Huzur", "Sakin", "Dünya", "Anlaşma"] },
    { word: "HAYAL", taboo: ["Düş", "Uyku", "Rüya", "Hayal kurmak", "Düşünce"] },

    // ÜLKELER & ŞEHİRLER
    { word: "İSTANBUL", taboo: ["Boğaz", "Köprü", "Büyük", "Türkiye", "İstanbul"] },
    { word: "PARİS", taboo: ["Eyfel", "Fransa", "Romantik", "Moda", "Sanat"] },
    { word: "JAPONYA", taboo: ["Tokyo", "Suşi", "Samuray", "Anime", "Ada"] },
    { word: "MISIR", taboo: ["Piramit", "Firavun", "Nil", "Sfenks", "Çöl"] },
    { word: "BREZİLYA", taboo: ["Samba", "Futbol", "Amazon", "Karnaval", "Rio"] },
    { word: "İTALYA", taboo: ["Roma", "Pizza", "Pasta", "Moda", "Sanat"] },
    { word: "AVUSTRALYA", taboo: ["Kanguru", "Koala", "Ada", "Sydney", "Opera"] },
    { word: "HİNDİSTAN", taboo: ["Hint", "Tac Mahal", "Bol nüfus", "Yoga", "Fil"] },

    // EĞLENCE
    { word: "KONSERİ", taboo: ["Müzik", "Sahne", "Şarkıcı", "Bilet", "Canlı"] },
    { word: "PARTİ", taboo: ["Kutlama", "Dans", "Eğlence", "Doğum günü", "Misafir"] },
    { word: "DANS", taboo: ["Müzik", "Hareket", "Ritim", "Sahne", "Adım"] },
    { word: "OYUN", taboo: ["Eğlence", "Kural", "Kazanmak", "Oynamak", "Çocuk"] },
    { word: "TATİL", taboo: ["Dinlenmek", "Seyahat", "Plaj", "Otel", "Gezi"] },
    { word: "PİKNİK", taboo: ["Doğa", "Orman", "Mangal", "Açık hava", "Sepet"] },
    { word: "SİRK", taboo: ["Palyaço", "Akrobat", "Çadır", "Gösteri", "Hayvan"] },
    { word: "SİHİRBAZ", taboo: ["Şapka", "Tavşan", "Hile", "Gösteri", "Asa"] },

    // DOĞA
    { word: "GÖKKUŞAĞI", taboo: ["Renkler", "Yağmur", "Güneş", "Yedi", "Köprü"] },
    { word: "YANARDAĞ", taboo: ["Lav", "Patlama", "Dağ", "Ateş", "Sıcak"] },
    { word: "ŞELALEİ", taboo: ["Su", "Düşmek", "Niagara", "Yüksek", "Doğa"] },
    { word: "ÇÖLE", taboo: ["Kum", "Sıcak", "Deve", "Kurak", "Vaha"] },
    { word: "OKYANUSSI", taboo: ["Deniz", "Su", "Derin", "Balık", "Dalga"] },
    { word: "ORMAN", taboo: ["Ağaç", "Yeşil", "Hayvan", "Doğa", "Yaprak"] },
    { word: "MAĞARA", taboo: ["Karanlık", "Yer altı", "Yarasa", "Kayaalık", "Giriş"] },
    { word: "BUZUL", taboo: ["Buz", "Soğuk", "Kutup", "Erimek", "Beyaz"] }
];

// Shuffle fonksiyonu
function shuffleWords() {
    const shuffled = [...WORD_LIST];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}
