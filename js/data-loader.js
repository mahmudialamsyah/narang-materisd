// Narang Education - Data Loader
// GitHub: https://github.com/[USERNAME]/narang-education-data

const NARANG_CONFIG = {
    DATA_BASE_URL: "https://raw.githubusercontent.com/[USERNAME]/narang-education-data/main/data/",
    ASSETS_BASE_URL: "https://raw.githubusercontent.com/[USERNAME]/narang-education-data/main/assets/",
    CACHE_PREFIX: "narang_v1_",
    VERSION: "1.2.0"
};

class NarangDataLoader {
    constructor() {
        this.cache = new Map();
        this.loading = new Map();
        this.initCache();
    }
    
    initCache() {
        // Load cache from localStorage
        try {
            const saved = localStorage.getItem(NARANG_CONFIG.CACHE_PREFIX + 'data');
            if (saved) {
                const parsed = JSON.parse(saved);
                const expiry = parsed.expiry || 0;
                if (Date.now() < expiry) {
                    this.cache = new Map(Object.entries(parsed.data));
                    console.log('Cache loaded from localStorage');
                } else {
                    localStorage.removeItem(NARANG_CONFIG.CACHE_PREFIX + 'data');
                }
            }
        } catch (e) {
            console.warn('Failed to load cache:', e);
        }
    }
    
    saveCache() {
        try {
            const data = {
                data: Object.fromEntries(this.cache),
                expiry: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
            };
            localStorage.setItem(NARANG_CONFIG.CACHE_PREFIX + 'data', JSON.stringify(data));
        } catch (e) {
            console.warn('Failed to save cache:', e);
        }
    }
    
    async loadCategory(categoryId) {
        const cacheKey = `${categoryId}_${NARANG_CONFIG.VERSION}`;
        
        // Check cache first
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        
        // Prevent duplicate loading
        if (this.loading.has(cacheKey)) {
            return this.loading.get(cacheKey);
        }
        
        // Create loading promise
        const loadPromise = new Promise(async (resolve, reject) => {
            try {
                console.log(`Loading ${categoryId} from GitHub...`);
                
                const url = `${NARANG_CONFIG.DATA_BASE_URL}${categoryId}.json?v=${Date.now()}`;
                const response = await fetch(url, {
                    headers: {
                        'Accept': 'application/json',
                        'Cache-Control': 'no-cache'
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                let data = await response.json();
                
                // Process Arabic text and fractions
                data = this.processContent(data);
                
                // Cache the result
                this.cache.set(cacheKey, data);
                this.saveCache();
                
                resolve(data);
            } catch (error) {
                console.error(`Failed to load ${categoryId}:`, error);
                reject(error);
            } finally {
                this.loading.delete(cacheKey);
            }
        });
        
        this.loading.set(cacheKey, loadPromise);
        return loadPromise;
    }
    
    processContent(data) {
        // Process each category
        Object.keys(data).forEach(category => {
            if (Array.isArray(data[category])) {
                data[category].forEach(topic => {
                    // Process summary
                    if (topic.summary && typeof topic.summary === 'string') {
                        topic.summary = this.enhanceContent(topic.summary);
                    }
                    
                    // Process questions
                    if (Array.isArray(topic.questions)) {
                        topic.questions = topic.questions.map(q => ({
                            q: this.enhanceContent(q.q),
                            a: this.enhanceContent(q.a)
                        }));
                    }
                });
            }
        });
        
        return data;
    }
    
    enhanceContent(text) {
        if (typeof text !== 'string') return text;
        
        let enhanced = text;
        
        // 1. Convert simple fractions to vertical format
        enhanced = enhanced.replace(
            /(\d+)\s*\/\s*(\d+)/g, 
            '<span class="vertical-fraction"><span class="num">$1</span><span class="den">$2</span></span>'
        );
        
        // 2. Convert complex fractions
        enhanced = enhanced.replace(
            /\[frac:(\d+)\/(\d+)\]/g,
            '<span class="vertical-fraction"><span class="num">$1</span><span class="den">$2</span></span>'
        );
        
        // 3. Mark Arabic text
        enhanced = enhanced.replace(
            /\[arabic:(.+?)\]/g,
            '<span class="arabic-text">$1</span>'
        );
        
        // 4. Process image tags
        enhanced = enhanced.replace(
            /\[img:(.+?)(?:\|(.+?))?\]/g,
            (match, url, caption) => {
                return `<div class="image-container">
                    <img src="${url}" alt="${caption || 'Ilustrasi'}" loading="lazy">
                    ${caption ? `<div class="image-caption">${caption}</div>` : ''}
                </div>`;
            }
        );
        
        return enhanced;
    }
    
    async loadAllCategories() {
        const categories = ['agama', 'indo', 'english', 'ipa', 'math', 'seni', 'geo', 'sejarah', 'dunia', 'others', 'random'];
        const results = {};
        
        for (const cat of categories) {
            try {
                const data = await this.loadCategory(cat);
                Object.assign(results, data);
            } catch (error) {
                console.warn(`Failed to load ${cat}:`, error);
            }
        }
        
        return results;
    }
    
    clearCache() {
        this.cache.clear();
        this.loading.clear();
        localStorage.removeItem(NARANG_CONFIG.CACHE_PREFIX + 'data');
    }
}

// Initialize global data loader
window.narangDataLoader = new NarangDataLoader();

// Helper functions for the main app
window.loadNarangData = async function() {
    try {
        showLoading('Memuat data pembelajaran...');
        
        // Try to load all categories
        const gameData = await window.narangDataLoader.loadAllCategories();
        
        // Inject into the main app
        if (typeof window.initNarangApp === 'function') {
            window.gameData = gameData;
            window.initNarangApp();
        }
        
        hideLoading();
        return gameData;
    } catch (error) {
        console.error('Failed to load app data:', error);
        showError('Gagal memuat data. Periksa koneksi internet Anda.');
        throw error;
    }
};

// UI Helper functions
function showLoading(message) {
    // Create or show loading overlay
    let overlay = document.getElementById('narang-loading');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'narang-loading';
        overlay.innerHTML = `
            <div class="loading-content">
                <div class="spinner"></div>
                <div class="loading-text">${message}</div>
            </div>
        `;
        document.body.appendChild(overlay);
    }
    overlay.style.display = 'flex';
}

function hideLoading() {
    const overlay = document.getElementById('narang-loading');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'narang-error';
    errorDiv.innerHTML = `
        <div class="error-content">
            <h3>⚠️ Terjadi Kesalahan</h3>
            <p>${message}</p>
            <button onclick="location.reload()">Muat Ulang</button>
            <button onclick="window.narangDataLoader.clearCache(); location.reload()">
                Bersihkan Cache & Muat Ulang
            </button>
        </div>
    `;
    document.body.appendChild(errorDiv);
}

// Auto-load when script is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Check if we're in the app container
    if (document.getElementById('narang-riddle-pro')) {
        setTimeout(() => {
            window.loadNarangData().catch(console.error);
        }, 500);
    }
});
