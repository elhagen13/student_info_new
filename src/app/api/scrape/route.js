import { NextRequest, NextResponse } from "next/server";

export async function POST(request) {
  const { url } = await request.json();
  if (!url) return new NextResponse("Please provide a URL.", { status: 400 });

  let inputUrl = url.trim();
  if (!/^https?:\/\//i.test(inputUrl)) {
    inputUrl = `http://${inputUrl}`;
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(inputUrl);
  } catch {
    return new NextResponse("Invalid URL provided.", { status: 400 });
  }

  let browser;
  try {
    const isVercel = !!process.env.VERCEL_ENV;

    if (isVercel) {
      const playwright = require("playwright-core");
      const chromium = require("playwright-aws-lambda");

      browser = await playwright.chromium.launch({
        args: chromium.args,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
      });
    } else {
      const puppeteer = await import("puppeteer");
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    }

    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    );
    await page.goto(parsedUrl.toString(), { waitUntil: "domcontentloaded", timeout: 30000 });

    const htmlContent = await page.content();
    const title = await page.title();

    return NextResponse.json({ success: true, title, html: htmlContent, url: inputUrl });

  } catch (error) {
    console.error("Browser error:", error);
    return new NextResponse("Failed to scrape page", { status: 500 });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
