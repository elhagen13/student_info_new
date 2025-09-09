import { NextRequest, NextResponse } from "next/server";

export async function POST(request) {
  const { url } = await request.json();
  
  if (!url) {
    return new NextResponse("Please provide a URL.", { status: 400 });
  }

  // Prepend http:// if missing
  let inputUrl = url.trim();
  if (!/^https?:\/\//i.test(inputUrl)) {
    inputUrl = `http://${inputUrl}`;
  }

  // Validate the URL is a valid HTTP/HTTPS URL
  let parsedUrl;
  try {
    parsedUrl = new URL(inputUrl);
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return new NextResponse("URL must start with http:// or https://", {
        status: 400,
      });
    }
  } catch {
    return new NextResponse("Invalid URL provided.", { status: 400 });
  }

  let browser;
  try {
    const isVercel = !!process.env.VERCEL_ENV;

    if (isVercel) {
      // Use Playwright for Vercel deployment
      const { chromium } = await import("playwright-core");
      
      browser = await chromium.launch({
        headless: true,
      });
    } else {
      // Use regular Puppeteer for local development
      const puppeteer = await import("puppeteer");
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    }

    const page = await browser.newPage();
    
    // Set a user agent to avoid bot detection
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Navigate to the page
    await page.goto(parsedUrl.toString(), { 
      waitUntil: isVercel ? "networkidle" : "networkidle2",
      timeout: 30000 
    });
    
    const htmlContent = await page.content();
    const title = await page.title();

    return NextResponse.json({
      success: true,
      title,
      html: htmlContent,
      url: inputUrl
    });

  } catch (error) {
    console.error("Browser error:", error);
    
    // Return more specific error messages
    if (error.message.includes('Failed to launch')) {
      return new NextResponse(
        "Failed to launch browser. This might be due to missing dependencies.",
        { status: 500 }
      );
    } else if (error.message.includes('timeout')) {
      return new NextResponse(
        "The webpage took too long to load. Please try again.",
        { status: 408 }
      );
    } else {
      return new NextResponse(
        "An error occurred while processing the webpage.",
        { status: 500 }
      );
    }
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error("Error closing browser:", closeError);
      }
    }
  }
}