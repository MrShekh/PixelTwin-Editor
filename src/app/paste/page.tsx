"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { createProject } from "@/lib/project-manager"

export default function PastePage() {
    const [html, setHtml] = useState("")
    const [css, setCss] = useState("")
    const router = useRouter()

    const handleCreate = () => {
        let finalHtml = html;
        if (css) {
            finalHtml = `<style>${css}</style>` + html;
        }

        const project = createProject({
            name: "Pasted Project",
            html: finalHtml,
            css: [],
        })

        router.push(`/editor/${project.id}`)
    }

    return (
        <div className="p-8 max-w-4xl mx-auto min-h-screen bg-slate-50 dark:bg-slate-950">
            <h1 className="text-3xl font-bold mb-8">Paste HTML & CSS</h1>
            <div className="grid gap-6">
                <div>
                    <label className="block mb-2 font-medium">HTML</label>
                    <textarea
                        className="w-full h-64 p-4 border rounded-md font-mono text-sm bg-white dark:bg-slate-900"
                        value={html}
                        onChange={(e) => setHtml(e.target.value)}
                        placeholder="<div>Hello World</div>"
                    />
                </div>
                <div>
                    <label className="block mb-2 font-medium">CSS</label>
                    <textarea
                        className="w-full h-64 p-4 border rounded-md font-mono text-sm bg-white dark:bg-slate-900"
                        value={css}
                        onChange={(e) => setCss(e.target.value)}
                        placeholder="body { background: #fff; }"
                    />
                </div>
                <Button size="lg" onClick={handleCreate}>Create Project</Button>
            </div>
        </div>
    )
}
