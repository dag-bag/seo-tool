import { type NextRequest, NextResponse } from "next/server"
import * as cheerio from "cheerio"

// Define the SEO data structure
interface SeoData {
  url: string
  statusCode: number
  title: string
  metaDescription: string
  canonical: string
  h1: string
  h2Count: number
  imgCount: number
  imgWithAlt: number
  wordCount: number
}

// Set a limit for the number of URLs to analyze
const MAX_URLS = 500

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const domain = searchParams.get("domain")

  if (!domain) {
    return NextResponse.json({ error: "Domain parameter is required" }, { status: 400 })
  }

  // Normalize the domain URL
  let baseUrl = domain
  if (!baseUrl.startsWith("http")) {
    baseUrl = `https://${baseUrl}`
  }

  // Create a stream for sending progress updates
  const stream = new TransformStream()
  const writer = stream.writable.getWriter()

  // Process the website in the background
  analyzeWebsite(baseUrl, writer).catch((error) => {
    console.error("Error analyzing website:", error)
    writer.close()
  })

  // Return the stream as the response
  return new NextResponse(stream.readable, {
    headers: {
      "Content-Type": "application/json",
      "Transfer-Encoding": "chunked",
    },
  })
}

async function analyzeWebsite(baseUrl: string, writer: WritableStreamDefaultWriter) {
  try {
    // Initialize the queue with the base URL
    const queue: string[] = [baseUrl]
    const visited = new Set<string>()
    const results: SeoData[] = []

    // Process URLs until the queue is empty or we reach the limit
    while (queue.length > 0 && visited.size < MAX_URLS) {
      const url = queue.shift()!

      // Skip if we've already visited this URL
      if (visited.has(url)) continue

      // Mark as visited
      visited.add(url)

      try {
        // Send progress update
        const progressData = {
          type: "progress",
          value: Math.round((visited.size / MAX_URLS) * 100),
        }
        await writer.write(encoder.encode(JSON.stringify(progressData) + "\n"))

        // Fetch and analyze the page
        const data = await analyzePage(url, baseUrl)
        results.push(data)

        // Send the result
        const resultData = {
          type: "result",
          value: data,
        }
        await writer.write(encoder.encode(JSON.stringify(resultData) + "\n"))

        // Extract new URLs from the page and add them to the queue
        if (data.statusCode === 200) {
          const newUrls = await extractUrls(url, baseUrl)

          for (const newUrl of newUrls) {
            if (!visited.has(newUrl) && !queue.includes(newUrl) && queue.length + visited.size < MAX_URLS) {
              queue.push(newUrl)
            }
          }
        }
      } catch (error) {
        console.error(`Error processing ${url}:`, error)
      }

      // Add a small delay to avoid overwhelming the server
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    // Send final progress update
    const finalProgress = {
      type: "progress",
      value: 100,
    }
    await writer.write(encoder.encode(JSON.stringify(finalProgress) + "\n"))

    // Close the writer when done
    writer.close()
  } catch (error) {
    console.error("Error in analyzeWebsite:", error)
    writer.close()
  }
}

async function analyzePage(url: string, baseUrl: string): Promise<SeoData> {
  try {
    // Fetch the page
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SEOAnalyzerBot/1.0; +https://example.com)",
      },
    })

    const statusCode = response.status

    // Initialize default data
    const data: SeoData = {
      url,
      statusCode,
      title: "",
      metaDescription: "",
      canonical: "",
      h1: "",
      h2Count: 0,
      imgCount: 0,
      imgWithAlt: 0,
      wordCount: 0,
    }

    // If the response is not OK, return with just the status code
    if (!response.ok) {
      return data
    }

    // Get the content type
    const contentType = response.headers.get("content-type") || ""

    // Only process HTML pages
    if (!contentType.includes("text/html")) {
      return data
    }

    // Get the HTML content
    const html = await response.text()

    // Parse the HTML
    const $ = cheerio.load(html)

    // Extract SEO data
    data.title = $("title").text().trim()
    data.metaDescription = $('meta[name="description"]').attr("content") || ""
    data.canonical = $('link[rel="canonical"]').attr("href") || ""
    data.h1 = $("h1").first().text().trim()
    data.h2Count = $("h2").length
    data.imgCount = $("img").length
    data.imgWithAlt = $("img[alt]").length

    // Calculate word count (approximate)
    const bodyText = $("body").text().trim()
    data.wordCount = bodyText.split(/\s+/).filter(Boolean).length

    return data
  } catch (error) {
    console.error(`Error analyzing ${url}:`, error)
    return {
      url,
      statusCode: 0,
      title: "",
      metaDescription: "",
      canonical: "",
      h1: "",
      h2Count: 0,
      imgCount: 0,
      imgWithAlt: 0,
      wordCount: 0,
    }
  }
}

async function extractUrls(url: string, baseUrl: string): Promise<string[]> {
  try {
    // Fetch the page
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SEOAnalyzerBot/1.0; +https://example.com)",
      },
    })

    // If the response is not OK, return empty array
    if (!response.ok) {
      return []
    }

    // Get the content type
    const contentType = response.headers.get("content-type") || ""

    // Only process HTML pages
    if (!contentType.includes("text/html")) {
      return []
    }

    // Get the HTML content
    const html = await response.text()

    // Parse the HTML
    const $ = cheerio.load(html)

    // Extract all links
    const links = new Set<string>()

    $("a[href]").each((_, element) => {
      const href = $(element).attr("href")
      if (!href) return

      try {
        // Resolve relative URLs
        let fullUrl: string
        if (href.startsWith("http")) {
          fullUrl = href
        } else if (href.startsWith("/")) {
          // Get the base domain
          const urlObj = new URL(baseUrl)
          fullUrl = `${urlObj.protocol}//${urlObj.host}${href}`
        } else if (!href.startsWith("#") && !href.startsWith("javascript:") && !href.startsWith("mailto:")) {
          // Handle relative paths
          const urlObj = new URL(url)
          const path = urlObj.pathname.endsWith("/")
            ? urlObj.pathname
            : urlObj.pathname.substring(0, urlObj.pathname.lastIndexOf("/") + 1)
          fullUrl = `${urlObj.protocol}//${urlObj.host}${path}${href}`
        } else {
          return
        }

        // Only include URLs from the same domain
        const urlObj = new URL(fullUrl)
        const baseUrlObj = new URL(baseUrl)

        if (urlObj.host === baseUrlObj.host) {
          // Remove hash and query parameters
          fullUrl = fullUrl.split("#")[0].split("?")[0]

          // Remove trailing slash for consistency
          if (fullUrl.endsWith("/") && fullUrl !== baseUrl) {
            fullUrl = fullUrl.slice(0, -1)
          }

          links.add(fullUrl)
        }
      } catch (error) {
        // Invalid URL, skip
      }
    })

    return Array.from(links)
  } catch (error) {
    console.error(`Error extracting URLs from ${url}:`, error)
    return []
  }
}

// Create a TextEncoder for writing to the stream
const encoder = new TextEncoder()
