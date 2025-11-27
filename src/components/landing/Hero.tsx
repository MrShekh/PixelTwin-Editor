"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createProject } from "@/lib/project-manager"
import { Loader2, Wand2 } from "lucide-react"

export function Hero() {
    const [url, setUrl] = useState("")
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const handleClone = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!url) return
        setLoading(true)
        try {
            const res = await fetch('/api/clone', {
                method: 'POST',
                body: JSON.stringify({ url }),
            })
            if (!res.ok) throw new Error('Failed to clone')
            const data = await res.json()

            const project = createProject({
                name: new URL(url).hostname,
                originalUrl: url,
                html: data.html,
                css: data.assets.styles,
                assets: data.assets.images
            })

            router.push(`/editor/${project.id}`)
        } catch (error) {
            console.error(error)
            alert("Failed to clone website. Please try again.")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] text-center px-4">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tighter mb-6 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                Clone. Edit. Deploy.
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl">
                Turn any website into an editable project in seconds. Use AI to rewrite content and customize the design.
            </p>

            <form onSubmit={handleClone} className="flex flex-col w-full max-w-md items-center space-y-4">
                <div className="flex w-full items-center space-x-2">
                    <Input
                        type="url"
                        placeholder="https://example.com"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        required
                        className="h-12"
                    />
                    <Button type="submit" size="lg" disabled={loading} className="h-12 px-8">
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                        Clone
                    </Button>
                </div>
                <div className="flex items-center space-x-2 text-sm text-muted-foreground text-left w-full pl-1">
                    <input type="checkbox" required id="legal" className="rounded border-gray-300" />
                    <label htmlFor="legal" className="text-xs">
                        I confirm that I have the rights to clone this website and accept full responsibility.
                    </label>
                </div>
            </form>

            <div className="mt-8 flex gap-4 text-sm text-muted-foreground">
                <Button variant="link" onClick={() => router.push('/upload')}>Upload Files</Button>
                <Button variant="link" onClick={() => router.push('/paste')}>Paste HTML/CSS</Button>
            </div>
        </div>
    )
}
