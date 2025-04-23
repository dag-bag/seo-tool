import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowRight } from "lucide-react"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="max-w-3xl w-full space-y-8 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">SEO Analyzer Tool</h1>
        <p className="text-lg text-slate-600">
          Enter a domain to analyze SEO metrics for up to 500 links on the website
        </p>

        <form action="/analyze" className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto mt-8">
          <Input name="domain" type="url" placeholder="https://example.com" required className="flex-1" />
          <Button type="submit" className="gap-2">
            Analyze
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>

        <div className="mt-12 text-sm text-slate-500">
          <p>Analyzes canonical URLs, meta tags, titles, and more</p>
        </div>
      </div>
    </main>
  )
}
