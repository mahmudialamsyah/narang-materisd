// CONFIGURASI
const CONFIG = {
    DATA_BASE_URL: "https://raw.githubusercontent.com/[USERNAME]/[REPO]/main/data/",
    ASSETS_BASE_URL: "https://raw.githubusercontent.com/[USERNAME]/[REPO]/main/assets/",
    CACHE_DURATION: 3600000, // 1 jam dalam milidetik
    VERSION: "1.0.0"
};

// GLOBAL STATE
let appState = {
    loadedCategories: {},
    cache: {},
    user: null,
    session: null
};

// UTILITY FUNCTIONS
function parseArabicText(text) {
    // Unicode Arabic range
    const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
    if (arabicRegex.test(text)) {
        return `<span dir="rtl" lang="ar" style="font-family: 'Scheherazade', 'Lateef', 'Amiri', serif; font-size: 1.2em;">${text}</span>`;
    }
    return text;
}

function renderFraction(text) {
    // Format pecahan: "1/2" menjadi tampilan vertikal
    return text.replace(/(\d+)\/(\d+)/g, (match, num, den) => {
        return `<span class="vertical-fraction">
            <span class="numerator">${num}</span>
            <span class="fraction-line"></span>
            <span class="denominator">${den}</span>
        </span>`;
    });
}

function renderImageInText(text) {
    // Mendeteksi dan merender gambar
    const imgRegex = /\[img:(.+?)\]/g;
    return text.replace(imgRegex, (match, url) => {
        return `<div class="responsive-image">
            <img src="${url}" alt="Gambar ilustrasi" loading="lazy" onload="this.style.opacity=1" onerror="this.style.display='none'">
            <div class="image-loader">Memuat gambar...</div>
        </div>`;
    });
}

function sanitizeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// CACHE MANAGEMENT
class DataCache {
    constructor() {
        this.cache = JSON.parse(localStorage.getItem('narang_cache') || '{}');
        this.expiry = JSON.parse(localStorage.getItem('narang_cache_expiry') || '{}');
    }

    set(key, data) {
        const now = Date.now();
        this.cache[key] = data;
        this.expiry[key] = now + CONFIG.CACHE_DURATION;
        this.persist();
    }

    get(key) {
        const now = Date.now();
        if (this.cache[key] && this.expiry[key] > now) {
            return this.cache[key];
        }
        return null;
    }

    persist() {
        localStorage.setItem('narang_cache', JSON.stringify(this.cache));
        localStorage.setItem('narang_cache_expiry', JSON.stringify(this.expiry));
    }

    clear() {
        this.cache = {};
        this.expiry = {};
        this.persist();
    }
}

// DATA LOADER
class DataLoader {
    constructor() {
        this.cache = new DataCache();
        this.loading = {};
    }

    async loadCategory(categoryId) {
        const cacheKey = `category_${categoryId}_v${CONFIG.VERSION}`;
        
        // Cek cache
        const cached = this.cache.get(cacheKey);
        if (cached) {
            console.log(`Loaded ${categoryId} from cache`);
            return cached;
        }

        // Cegah loading ganda
        if (this.loading[categoryId]) {
            return this.loading[categoryId];
        }

        // Loading promise
        this.loading[categoryId] = new Promise(async (resolve, reject) => {
            try {
                const url = `${CONFIG.DATA_BASE_URL}${categoryId}.json`;
                console.log(`Fetching ${categoryId} from:`, url);
                
                const response = await fetch(url, {
                    headers: { 'Cache-Control': 'max-age=3600' }
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const data = await response.json();
                
                // Process data (parse Arabic, fractions, images)
                this.processCategoryData(data);
                
                // Simpan ke cache
                this.cache.set(cacheKey, data);
                
                resolve(data);
            } catch (error) {
                console.error(`Error loading ${categoryId}:`, error);
                reject(error);
            } finally {
                delete this.loading[categoryId];
            }
        });

        return this.loading[categoryId];
    }

    processCategoryData(data) {
        Object.keys(data).forEach(category => {
            data[category].forEach(topic => {
                // Process summary
                if (topic.summary) {
                    topic.summary = renderImageInText(topic.summary);
                    topic.summary = renderFraction(topic.summary);
                    topic.summary = parseArabicText(topic.summary);
                }
                
                // Process questions
                topic.questions = topic.questions.map(q => ({
                    q: parseArabicText(renderFraction(q.q)),
                    a: parseArabicText(renderFraction(q.a))
                }));
            });
        });
    }

    async loadAllCategories() {
        const categories = ['agama', 'indo', 'english', 'ipa', 'math', 'seni', 'geo', 'sejarah', 'dunia', 'others', 'random'];
        const promises = categories.map(cat => this.loadCategory(cat));
        return Promise.all(promises);
    }
}

// MAIN APP INITIALIZATION
async function initNarangApp() {
    console.log('Initializing Narang Education App...');
    
    // Initialize data loader
    const dataLoader = new DataLoader();
    window.narangDataLoader = dataLoader;
    
    // Load minimal data for login screen
    try {
        // Preload agama.json (first category)
        await dataLoader.loadCategory('agama');
        
        // Initialize UI
        setupEventListeners();
        initTheme();
        
        console.log('App initialized successfully');
    } catch (error) {
        console.error('Failed to initialize app:', error);
        showErrorScreen('Gagal memuat data. Periksa koneksi internet Anda.');
    }
}

// UI FUNCTIONS
function setupEventListeners() {
    // Login event
    document.getElementById('login-btn').addEventListener('click', processLogin);
    
    // Category selection
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const categoryId = e.target.dataset.category;
            await loadCategoryData(categoryId);
        });
    });
    
    // Other event listeners...
}

async function loadCategoryData(categoryId) {
    showLoading(`Memuat materi ${categoryId}...`);
    
    try {
        const data = await window.narangDataLoader.loadCategory(categoryId);
        displayCategoryData(categoryId, data);
    } catch (error) {
        showError(`Gagal memuat data ${categoryId}: ${error.message}`);
    } finally {
        hideLoading();
    }
}

function displayCategoryData(categoryId, data) {
    const container = document.getElementById('category-content');
    
    data[categoryId].forEach(topic => {
        const topicHTML = `
            <div class="topic-card">
                <h3>${topic.title}</h3>
                <div class="topic-summary">${topic.summary}</div>
                <button class="btn-study" onclick="startStudy('${categoryId}', '${topic.title}')">
                    Pelajari
                </button>
                <button class="btn-quiz" onclick="startQuiz('${categoryId}', '${topic.title}')">
                    Kuis
                </button>
            </div>
        `;
        container.innerHTML += topicHTML;
    });
}

// ERROR HANDLING
function showErrorScreen(message) {
    document.body.innerHTML = `
        <div class="error-container">
            <h2>⚠️ Terjadi Kesalahan</h2>
            <p>${message}</p>
            <button onclick="location.reload()">Muat Ulang</button>
            <button onclick="window.narangDataLoader.cache.clear(); location.reload()">
                Bersihkan Cache & Muat Ulang
            </button>
        </div>
    `;
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNarangApp);
} else {
    initNarangApp();
}
