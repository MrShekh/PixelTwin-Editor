"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { createProject } from "@/lib/project-manager"
import { Upload } from "lucide-react"

export default function UploadPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setLoading(true)
        try {
            const text = await file.text()

            const project = createProject({
                name: file.name.replace('.html', ''),
                html: text,
                css: [],
            })

            router.push(`/editor/${project.id}`)
        } catch (e) {
            alert("Failed to read file")
            setLoading(false)
        }
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 p-4">
            <div className="bg-white dark:bg-slate-900 p-8 rounded-xl shadow-lg max-w-md w-full text-center border">
                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Upload className="w-8 h-8" />
                </div>
                <h1 className="text-2xl font-bold mb-2">Upload HTML File</h1>
                <p className="text-muted-foreground mb-8">Select an HTML file to start editing.</p>

                <div className="relative">
                    <Button size="lg" className="w-full" disabled={loading}>
                        {loading ? "Processing..." : "Select File"}
                    </Button>
                    <input
                        type="file"
                        accept=".html,.htm"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        onChange={handleFileChange}
                    />
                </div>
            </div>
        </div>
    )
}
