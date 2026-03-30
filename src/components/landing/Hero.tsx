"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { createProject } from "@/lib/project-manager"
import { Loader2, Wand2, MonitorPlay, Sparkles, ArrowRight, Globe, Zap, Layers } from "lucide-react"
import { motion } from "framer-motion"

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

            const project = await createProject({
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

    const features = [
        { icon: Globe, label: "Clone Any Site", desc: "Instant snapshot" },
        { icon: Zap, label: "AI-Powered Edit", desc: "Claude & LLaMA" },
        { icon: Layers, label: "Deploy Anywhere", desc: "Vercel & GitHub" },
    ]

    return (
        <div className="flex flex-col items-center justify-center min-h-[88vh] text-center px-4 pt-16 pb-20 relative">

            {/* Ambient background blobs */}
            <div className="absolute top-[15%] left-[8%] w-72 h-72 rounded-full opacity-30 blur-3xl pointer-events-none" style={{ background: 'radial-gradient(circle, #FDBA74, transparent)' }} />
            <div className="absolute top-[25%] right-[8%] w-80 h-80 rounded-full opacity-20 blur-3xl pointer-events-none animate-blob animation-delay-2000" style={{ background: 'radial-gradient(circle, #FCA5A5, transparent)' }} />
            <div className="absolute bottom-[15%] left-[20%] w-60 h-60 rounded-full opacity-25 blur-3xl pointer-events-none animate-blob animation-delay-4000" style={{ background: 'radial-gradient(circle, #FB923C, transparent)' }} />

            {/* Badge */}
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8 border"
                style={{ background: 'var(--accent-light)', borderColor: 'var(--accent-border)' }}
            >
                <span className="w-2 h-2 rounded-full pulse-dot" style={{ background: 'var(--accent)' }} />
                <span className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>
                    PixelTwin Studio &nbsp;·&nbsp; AI-Powered Web Editor
                </span>
                <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
            </motion.div>

            {/* Heading */}
            <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight mb-5 leading-[1.05]"
                style={{ color: 'var(--text-primary)' }}
            >
                Clone.&nbsp;Edit.{' '}
                <span className="relative inline-block">
                    <span className="relative z-10" style={{ background: 'linear-gradient(135deg, var(--accent), #F59E0B)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        Deploy.
                    </span>
                    <span className="absolute -bottom-1 left-0 right-0 h-3 rounded-full opacity-30 -rotate-1 z-0"
                          style={{ background: 'var(--accent)' }} />
                </span>
            </motion.h1>

            {/* Subheading */}
            <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-lg md:text-xl mb-12 max-w-xl leading-relaxed font-medium"
                style={{ color: 'var(--text-secondary)' }}
            >
                Clone any website, edit every pixel with AI, and ship it live — all without writing a single line of code.
            </motion.p>

            {/* URL Input Card */}
            <motion.div
                initial={{ opacity: 0, y: 24, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.3, type: "spring", bounce: 0.3 }}
                className="w-full max-w-xl relative"
            >
                {/* Glow ring */}
                <div className="absolute -inset-px rounded-2xl opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                     style={{ background: 'linear-gradient(135deg, var(--accent), #F59E0B)', filter: 'blur(8px)' }} />

                <form onSubmit={handleClone}
                    className="relative rounded-2xl p-2 flex flex-col sm:flex-row gap-2 shadow-xl"
                    style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border)' }}
                >
                    <div className="flex-1 flex items-center px-4 rounded-xl h-13 gap-3" style={{ background: 'var(--bg-sidebar)' }}>
                        <MonitorPlay className="w-4 h-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
                        <input
                            type="url"
                            placeholder="Paste any website URL…"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            required
                            className="w-full bg-transparent border-none outline-none text-sm font-mono"
                            style={{ color: 'var(--text-primary)', caretColor: 'var(--accent)' }}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="h-13 px-7 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all duration-200 disabled:opacity-60 group shrink-0"
                        style={{ background: 'var(--accent)', color: 'white' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-hover)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'var(--accent)')}
                    >
                        {loading ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Cloning…</>
                        ) : (
                            <><Wand2 className="w-4 h-4" /> Clone Site <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" /></>
                        )}
                    </button>
                </form>
            </motion.div>

            {/* Disclaimer */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.55 }}
                className="mt-5 flex items-center gap-3 text-xs font-medium"
                style={{ color: 'var(--text-muted)' }}
            >
                <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" required className="rounded accent-orange-500 w-3.5 h-3.5" />
                    I have rights to clone this site
                </label>
            </motion.div>

            {/* Feature Pills */}
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.65 }}
                className="mt-16 grid grid-cols-3 gap-4 max-w-lg w-full"
            >
                {features.map(({ icon: Icon, label, desc }) => (
                    <div key={label} className="warm-card px-4 py-3 flex flex-col items-center gap-1.5 rounded-xl">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-light)' }}>
                            <Icon className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                        </div>
                        <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{label}</p>
                        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{desc}</p>
                    </div>
                ))}
            </motion.div>
        </div>
    )
}
