"use client"
import { useSession, signIn, signOut } from "next-auth/react"
import { Github, LogOut } from "lucide-react"

export function AuthHeader() {
    const { data: session } = useSession()

    return (
        <header className="relative z-20 w-full flex items-center justify-between px-6 py-3"
            style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="font-black text-base tracking-tight" style={{ color: 'var(--text-primary)' }}>
                <span style={{ color: 'var(--accent)' }}>Pixel</span>Twin
            </div>

            {session ? (
                <div className="flex items-center gap-3">
                    {session.user?.image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={session.user.image} alt="" className="w-7 h-7 rounded-full" style={{ border: '1.5px solid var(--border)' }} />
                    )}
                    <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                        {session.user?.name}
                    </span>
                    <button
                        onClick={() => signOut()}
                        className="flex items-center gap-1.5 px-3 h-7 rounded-lg text-[11px] font-medium transition-all"
                        style={{ border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-muted)' }}>
                        <LogOut className="w-3 h-3" /> Sign out
                    </button>
                </div>
            ) : (
                <button
                    onClick={() => signIn("github")}
                    className="flex items-center gap-2 px-4 h-8 rounded-lg text-xs font-semibold text-white transition-all"
                    style={{ background: '#24292e' }}>
                    <Github className="w-3.5 h-3.5" /> Sign in with GitHub
                </button>
            )}
        </header>
    )
}
