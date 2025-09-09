import puppeteer from 'puppeteer';
import { NextResponse } from 'next/server';

export async function POST(request) {
  let browser;
  let page;

  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json(
        { message: 'URL is required' },
        { status: 400 }
      );
    }

    // Launch Puppeteer browser
    browser = await puppeteer.launch({
      headless: true, // Run in headless mode
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });

    // Create a new page
    page = await browser.newPage();

    // Set viewport size
    await page.setViewport({ width: 1920, height: 1080 });

    // Navigate to the URL
    await page.goto(url, { 
      waitUntil: 'networkidle0', // Wait until no network requests for 500ms
      timeout: 30000 // 30 second timeout
    });

    // Get the page content (HTML)
    const htmlContent = await page.content();

    // Get page title
    const title = await page.title();

    return NextResponse.json({
      success: true,
      title,
      html: htmlContent,
      url
    });

  } catch (error) {
    console.error('Puppeteer error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to scrape the website',
        error: error.message
      },
      { status: 500 }
    );
  } finally {
    if (page) {
      await page.close();
    }
    if (browser) {
      await browser.close();
    }
  }
}
