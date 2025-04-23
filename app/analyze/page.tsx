"use client"

import { useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Download, Filter, Loader2 } from "lucide-react"
import Link from "next/link"

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

export default function AnalyzePage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const domain = searchParams.get("domain")

  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState<SeoData[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState("")
  const itemsPerPage = 10

  // Start analysis when component mounts if domain is provided
  useState(() => {
    if (domain) {
      startAnalysis(domain)
    } else {
      router.push("/")
    }
  })

  async function startAnalysis(domain: string) {
    setIsAnalyzing(true)
    setProgress(0)
    setResults([])

    try {
      const response = await fetch(`/api/analyze?domain=${encodeURIComponent(domain)}`)

      if (!response.ok) {
        throw new Error("Failed to start analysis")
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error("Response body is not readable")

      const receivedResults: SeoData[] = []

      while (true) {
        const { done, value } = await reader.read()

        if (done) break

        // Convert the Uint8Array to a string
        const chunk = new TextDecoder().decode(value)

        // Parse the chunk as JSON
        try {
          const data = JSON.parse(chunk)

          if (data.type === "progress") {
            setProgress(data.value)
          } else if (data.type === "result") {
            receivedResults.push(data.value)
            setResults([...receivedResults])
          }
        } catch (e) {
          console.error("Error parsing chunk:", e)
        }
      }

      setIsAnalyzing(false)
      setProgress(100)
    } catch (error) {
      console.error("Analysis error:", error)
      setIsAnalyzing(false)
    }
  }

  // Filter results based on search term
  const filteredResults = results.filter(
    (item) =>
      item.url.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.metaDescription.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  // Paginate results
  const paginatedResults = filteredResults.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const totalPages = Math.ceil(filteredResults.length / itemsPerPage)

  // Generate pagination items
  const paginationItems = []
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
      paginationItems.push(
        <PaginationItem key={i}>
          <PaginationLink isActive={i === currentPage} onClick={() => setCurrentPage(i)}>
            {i}
          </PaginationLink>
        </PaginationItem>,
      )
    } else if (i === currentPage - 2 || i === currentPage + 2) {
      paginationItems.push(
        <PaginationItem key={i}>
          <PaginationLink>...</PaginationLink>
        </PaginationItem>,
      )
    }
  }

  // Export results as CSV
  function exportToCsv() {
    const headers = [
      "URL",
      "Status",
      "Title",
      "Meta Description",
      "Canonical",
      "H1",
      "H2 Count",
      "Image Count",
      "Images with Alt",
      "Word Count",
    ]

    const csvRows = [
      headers.join(","),
      ...filteredResults.map((item) =>
        [
          `"${item.url}"`,
          item.statusCode,
          `"${item.title.replace(/"/g, '""')}"`,
          `"${item.metaDescription.replace(/"/g, '""')}"`,
          `"${item.canonical}"`,
          `"${item.h1.replace(/"/g, '""')}"`,
          item.h2Count,
          item.imgCount,
          item.imgWithAlt,
          item.wordCount,
        ].join(","),
      ),
    ]

    const csvContent = csvRows.join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `seo-analysis-${domain?.replace(/https?:\/\//, "")}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <main className="container mx-auto py-6 px-4 max-w-7xl">
      <div className="flex items-center mb-8">
        <Link href="/" className="mr-4">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">SEO Analysis Results</h1>
      </div>

      {isAnalyzing ? (
        <Card>
          <CardHeader>
            <CardTitle>Analyzing {domain}</CardTitle>
            <CardDescription>Scanning up to 500 links. This may take a few minutes.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <div className="flex-1">
                  <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
                  </div>
                </div>
                <span className="text-sm text-muted-foreground">{progress}%</span>
              </div>

              <div className="text-sm text-muted-foreground">{results.length} URLs analyzed so far</div>
            </div>
          </CardContent>
        </Card>
      ) : results.length > 0 ? (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
            <div>
              <h2 className="text-lg font-medium">
                {results.length} URLs analyzed for {domain}
              </h2>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={exportToCsv} className="gap-2">
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <Input
              placeholder="Search results..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setCurrentPage(1)
              }}
              className="max-w-md"
            />

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="h-4 w-4" />
              Showing {filteredResults.length} of {results.length} results
            </div>
          </div>

          <Tabs defaultValue="table">
            <TabsList>
              <TabsTrigger value="table">Table View</TabsTrigger>
              <TabsTrigger value="cards">Card View</TabsTrigger>
            </TabsList>

            <TabsContent value="table" className="mt-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>URL</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Meta Description</TableHead>
                      <TableHead>Canonical</TableHead>
                      <TableHead>H1</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedResults.length > 0 ? (
                      paginatedResults.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium max-w-[200px] truncate">
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:underline text-blue-600"
                            >
                              {item.url.replace(/^https?:\/\//, "")}
                            </a>
                          </TableCell>
                          <TableCell>
                            <Badge variant={item.statusCode === 200 ? "success" : "destructive"}>
                              {item.statusCode}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate" title={item.title}>
                            {item.title || <span className="text-red-500">Missing</span>}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate" title={item.metaDescription}>
                            {item.metaDescription || <span className="text-red-500">Missing</span>}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate" title={item.canonical}>
                            {item.canonical || <span className="text-yellow-500">None</span>}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate" title={item.h1}>
                            {item.h1 || <span className="text-red-500">Missing</span>}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-4">
                          No results found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="cards" className="mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {paginatedResults.length > 0 ? (
                  paginatedResults.map((item, index) => (
                    <Card key={index}>
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-base truncate max-w-[300px]">
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:underline text-blue-600"
                            >
                              {item.url.replace(/^https?:\/\//, "")}
                            </a>
                          </CardTitle>
                          <Badge variant={item.statusCode === 200 ? "success" : "destructive"}>{item.statusCode}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <div>
                          <div className="font-medium">Title</div>
                          <div className="text-muted-foreground truncate">
                            {item.title || <span className="text-red-500">Missing</span>}
                          </div>
                        </div>
                        <div>
                          <div className="font-medium">Meta Description</div>
                          <div className="text-muted-foreground truncate">
                            {item.metaDescription || <span className="text-red-500">Missing</span>}
                          </div>
                        </div>
                        <div>
                          <div className="font-medium">Canonical</div>
                          <div className="text-muted-foreground truncate">
                            {item.canonical || <span className="text-yellow-500">None</span>}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <div className="font-medium">H1</div>
                            <div className="text-muted-foreground truncate">
                              {item.h1 || <span className="text-red-500">Missing</span>}
                            </div>
                          </div>
                          <div>
                            <div className="font-medium">H2 Count</div>
                            <div className="text-muted-foreground">{item.h2Count}</div>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <div className="font-medium">Images</div>
                            <div className="text-muted-foreground">{item.imgCount}</div>
                          </div>
                          <div>
                            <div className="font-medium">With Alt</div>
                            <div className="text-muted-foreground">{item.imgWithAlt}</div>
                          </div>
                          <div>
                            <div className="font-medium">Words</div>
                            <div className="text-muted-foreground">{item.wordCount}</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="col-span-2 text-center py-8">No results found</div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          {totalPages > 1 && (
            <Pagination className="mt-6">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                  />
                </PaginationItem>

                {paginationItems}

                <PaginationItem>
                  <PaginationNext
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No Results</CardTitle>
            <CardDescription>
              No analysis results available. Please go back and enter a domain to analyze.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/">
              <Button>Start New Analysis</Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </main>
  )
}
