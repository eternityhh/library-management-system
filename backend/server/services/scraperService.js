const puppeteer = require("puppeteer");

async function scrapeKongfzByISBN(isbn) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  try {
    const page = await browser.newPage();
    page.setViewport({ width: 1280, height: 800 });
    
    const searchUrl = `https://search.kongfz.com/product/?keyword=${isbn}&dataType=0`;
    await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 30000 });
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const firstBook = await page.evaluate(() => {
      const selectors = [
        '.item-box a',
        '.product-item a',
        '.result-item a',
        '[class*="item"] a',
        '#app a'
      ];
      
      for (const sel of selectors) {
        const elements = document.querySelectorAll(sel);
        for (const el of elements) {
          if (el.href && el.href.includes('/book/')) {
            const text = el.innerText?.trim() || '';
            const parts = text.split('\n');
            const title = parts[0] || '';
            const otherInfo = parts[1] || '';
            const author = otherInfo.split(' ')[0] || '';
            
            return {
              title: title,
              author: author,
              url: el.href
            };
          }
        }
      }
      return null;
    });

    if (!firstBook) {
      return null;
    }

    await page.goto(firstBook.url, { waitUntil: "networkidle2", timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const bookDetails = await page.evaluate(() => {
      const descSelectors = [
        '.description',
        '.intro',
        '.product-intro',
        '[class*="description"]',
        '[class*="intro"]',
        '.jianjie',
        '[class*="jianjie"]'
      ];
      
      let description = '';
      for (const sel of descSelectors) {
        const el = document.querySelector(sel);
        if (el) {
          let text = el.innerText.trim();
          if (text.startsWith('内容简介')) {
            text = text.replace(/内容简介[:：]?\s*/, '');
          }
          if (text.length > 10) {
            description = text;
            break;
          }
        }
      }
      return { description };
    });

    return {
      title: firstBook.title,
      author: firstBook.author,
      description: bookDetails.description
    };
  } finally {
    await browser.close();
  }
}

module.exports = {
  scrapeKongfzByISBN
};