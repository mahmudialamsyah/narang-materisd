const fs = require('fs');
const path = require('path');

// Konfigurasi
const DATA_DIR = './data';
const OUTPUT_FILE = './data-index.json';

function buildDataIndex() {
    const index = {};
    
    fs.readdirSync(DATA_DIR).forEach(file => {
        if (file.endsWith('.json')) {
            const category = file.replace('.json', '');
            const filePath = path.join(DATA_DIR, file);
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            
            // Proses data untuk konversi
            data[category].forEach(topic => {
                // Auto-convert fractions
                topic.summary = topic.summary.replace(/\b(\d+)\/(\d+)\b/g, 
                    '<span class="vertical-fraction"><span class="numerator">$1</span><span class="fraction-line"></span><span class="denominator">$2</span></span>');
                
                // Auto-convert images
                topic.summary = topic.summary.replace(/!\[(.*?)\]\((.*?)\)/g,
                    '<div class="responsive-image"><img src="$2" alt="$1"></div>');
            });
            
            index[category] = data[category];
        }
    });
    
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(index, null, 2));
    console.log('Data index built successfully!');
}

buildDataIndex();
