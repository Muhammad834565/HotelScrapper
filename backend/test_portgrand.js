const puppeteer = require('puppeteer-core');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({ 
    headless: true, 
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    args: ['--no-sandbox', '--window-size=1280,900'] 
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  
  const url = 'https://www.google.com/maps/place/Port+Grand+-+Karachi/@24.8450553,66.9908891,690m/data=!3m1!1e3!4m7!3m6!1s0x3eb315fd9484034d:0xa34ea99b28ea0c40!8m2!3d24.8450553!4d66.9908891!10e1!16s%2Fm%2F0h3q3xc?authuser=0&hl=en&entry=ttu&g_ep=EgoyMDI2MDkxNS4wIKXMDSoASAFQAw%3D%3D';
  await page.goto(url, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 4000));
  
  // Click About tab
  const clicked = await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('button[role="tab"], .G6fVbb, .hh2c6'));
    const aboutTab = tabs.find(t => t.textContent.toLowerCase().includes('about') || t.textContent.toLowerCase().includes('about'));
    if (aboutTab) {
      aboutTab.click();
      return true;
    }
    return false;
  });
  
  console.log('Tab clicked:', clicked);
  
  await new Promise(r => setTimeout(r, 3000));
  
  // Dump the HTML
  const aboutHtml = await page.evaluate(() => {
    const mainPanel = document.querySelector('div[role="main"]') || document.body;
    return mainPanel.innerHTML;
  });
  
  fs.writeFileSync('about_portgrand.html', aboutHtml);
  console.log('Saved HTML');
  await browser.close();
})();
