const puppeteer = require('puppeteer-core');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({ 
    headless: true, 
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    args: ['--no-sandbox'] 
  });
  const page = await browser.newPage();
  const html = fs.readFileSync('about_portgrand.html', 'utf8');
  await page.setContent(html);
  
  const result = await page.evaluate(() => {
    const aboutSection = {};
    const knownCategories = [
      'Accessibility', 'Service options', 'Highlights', 'Popular for', 
      'Offerings', 'Dining options', 'Amenities', 'Atmosphere', 
      'Crowd', 'Planning', 'Payments', 'Children', 'Parking'
    ];

    const titleEls = Array.from(document.querySelectorAll('.fontTitleSmall, h2, h3, .fontTitleMedium'));

    for (const titleEl of titleEls) {
        const catName = titleEl.textContent?.trim();
        if (!catName || catName.length < 3 || catName.length > 40) continue;
        
        const isKnown = knownCategories.includes(catName);
        if (!isKnown) continue; // STRCIT MODE
        
        const tags = [];
        let container = titleEl.parentElement;
        for (let i = 0; i < 5; i++) {
            if (!container) break;
            
            const itemEls = Array.from(container.querySelectorAll('li, .fontBodyMedium'));
            
            itemEls.forEach(el => {
                if (el === titleEl || el.contains(titleEl)) return;
                
                let text = el.textContent?.trim() || '';
                
                const spans = Array.from(el.querySelectorAll('span:not(:empty)'));
                if (spans.length > 0) {
                    const lastSpan = spans[spans.length - 1];
                    if (lastSpan.textContent) {
                        text = lastSpan.textContent.trim();
                    }
                }
                
                text = text.replace(/[\uE000-\uF8FF]/g, '').trim();
                
                if (text && text.length > 1 && text !== catName && !knownCategories.includes(text)) {
                    if (!['Travel time', 'Measure', 'Default', 'Satellite'].includes(text)) {
                        if (!tags.includes(text)) tags.push(text);
                    }
                }
            });
            
            if (tags.length > 0) break;
            container = container.parentElement;
        }
        
        if (tags.length > 0) {
            aboutSection[catName] = tags;
        }
    }
    return aboutSection;
  });
  
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})();
