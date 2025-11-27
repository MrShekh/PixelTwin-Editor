"use client"
import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { getProject, Project, saveProject } from '@/lib/project-manager'
import { Button } from '@/components/ui/button'
import { Loader2, Save, Undo, Redo, Wand2, Image as ImageIcon, Type, Download } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { exportProjectAsZip } from '@/lib/export-utils'

export default function EditorPage() {
  const params = useParams()
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [isIframeLoaded, setIsIframeLoaded] = useState(false)
  const [aiPrompt, setAiPrompt] = useState("")
  const [aiLoading, setAiLoading] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  // Load project
  useEffect(() => {
    if (params.id) {
      const p = getProject(params.id as string)
      setProject(p)
      setLoading(false)
    }
  }, [params.id])

  // Initialize iframe content - Only once when project is loaded
  useEffect(() => {
    if (project && iframeRef.current && !isIframeLoaded) {
      const doc = iframeRef.current.contentDocument
      if (doc) {
        doc.open()
        // Base structure
        doc.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <base href="${project.originalUrl || ''}" target="_blank">
              ${project.css.map(href => `<link rel="stylesheet" href="${href}">`).join('\n')}
              <style>
                .pixeltwin-hover { outline: 2px solid #3b82f6 !important; cursor: pointer; }
                .pixeltwin-selected { outline: 2px solid #ef4444 !important; }
                [contenteditable]:focus { outline: none; }
                body { padding-bottom: 100px; } /* Space for scrolling */
              </style>
            </head>
            <body>
              ${project.html}
              <script>
                // Editor Script
                document.body.addEventListener('mouseover', (e) => {
                  e.stopPropagation();
                  if (e.target === document.body) return;
                  e.target.classList.add('pixeltwin-hover');
                });
                document.body.addEventListener('mouseout', (e) => {
                  e.stopPropagation();
                  e.target.classList.remove('pixeltwin-hover');
                });
                document.body.addEventListener('click', (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  
                  // Notify parent
                  if (e.target.tagName === 'IMG') {
                     window.parent.postMessage({ type: 'IMAGE_SELECTED', src: e.target.src }, '*');
                  } else {
                     window.parent.postMessage({ type: 'ELEMENT_CLICK', tagName: e.target.tagName }, '*');
                  }
                  
                  // Selection visual
                  document.querySelectorAll('.pixeltwin-selected').forEach(el => el.classList.remove('pixeltwin-selected'));
                  e.target.classList.add('pixeltwin-selected');
                  
                  // Enable editing for text elements
                  const textTags = ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'SPAN', 'DIV', 'A', 'LI', 'BUTTON', 'LABEL'];
                  if (textTags.includes(e.target.tagName)) {
                     e.target.contentEditable = true;
                     e.target.focus();
                  }
                });
                
                // Sync changes back to parent
                const observer = new MutationObserver((mutations) => {
                   window.parent.postMessage({ type: 'CONTENT_UPDATE', html: document.body.innerHTML }, '*');
                });
                observer.observe(document.body, { subtree: true, childList: true, characterData: true });

                // Listen for updates from parent
                window.addEventListener('message', (event) => {
                  if (event.data.type === 'UPDATE_SELECTED_IMAGE') {
                    const selected = document.querySelector('.pixeltwin-selected');
                    if (selected && selected.tagName === 'IMG') {
                      selected.src = event.data.src;
                      // Trigger content update
                      window.parent.postMessage({ type: 'CONTENT_UPDATE', html: document.body.innerHTML }, '*');
                    }
                  }
                });
              </script>
            </body>
          </html>
        `)
        doc.close()
        setIsIframeLoaded(true)
      }
    }
  }, [project, isIframeLoaded])

  // Listen for messages from iframe
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data.type === 'CONTENT_UPDATE') {
        if (project) {
          // Update local state without re-rendering iframe
          setProject(prev => prev ? ({ ...prev, html: e.data.html }) : null)
        }
      } else if (e.data.type === 'IMAGE_SELECTED') {
        setSelectedImage(e.data.src);
      } else if (e.data.type === 'ELEMENT_CLICK') {
        setSelectedImage(null); // Deselect image if clicking something else
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [project])

  const handleSave = () => {
    if (project) {
      saveProject(project)
      alert('Project saved!')
    }
  }

  const handleExport = async () => {
    if (!project) return;
    try {
      const blob = await exportProjectAsZip(project);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.name || 'project'}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert('Failed to export');
    }
  }

  const handleAiEdit = async () => {
    if (!aiPrompt || !project) return;
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        body: JSON.stringify({
          prompt: aiPrompt,
          html: project.html
        })
      });
      const data = await res.json();
      if (data.modifiedHtml) {
        // In a real app, we would update the HTML here.
        // setProject({ ...project, html: data.modifiedHtml });
        alert(data.message || "AI Edit Complete");
      }
    } catch (e) {
      alert("AI Edit Failed");
    } finally {
      setAiLoading(false);
    }
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && iframeRef.current) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        iframeRef.current?.contentWindow?.postMessage({ type: 'UPDATE_SELECTED_IMAGE', src: result }, '*');
        setSelectedImage(result); // Update local preview
      };
      reader.readAsDataURL(file);
    }
  }

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>
  if (!project) return <div>Project not found</div>

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b px-4 py-2 bg-white dark:bg-slate-900 dark:border-slate-800">
        <div className="font-bold text-lg">PixelTwin Editor</div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm"><Undo className="w-4 h-4" /></Button>
          <Button variant="outline" size="sm"><Redo className="w-4 h-4" /></Button>
          <Button size="sm" onClick={handleSave}><Save className="w-4 h-4 mr-2" /> Save</Button>
          <Button size="sm" variant="secondary" onClick={handleExport}><Download className="w-4 h-4 mr-2" /> Export</Button>
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-72 border-r bg-slate-50 dark:bg-slate-900 dark:border-slate-800 p-4 flex flex-col gap-6">
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Tools</div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="justify-start"><Type className="mr-2 h-4 w-4" /> Text</Button>
              <Button variant="outline" className="justify-start"><ImageIcon className="mr-2 h-4 w-4" /> Image</Button>
            </div>
          </div>

          {selectedImage && (
            <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border shadow-sm">
              <div className="text-sm font-semibold mb-2">Edit Image</div>
              <div className="mb-4 aspect-video relative bg-slate-100 rounded overflow-hidden flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={selectedImage} alt="Selected" className="max-w-full max-h-full object-contain" />
              </div>
              <div className="relative">
                <Button className="w-full" variant="secondary">
                  <ImageIcon className="mr-2 h-4 w-4" /> Replace Image
                </Button>
                <input
                  type="file"
                  accept="image/*"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={handleImageUpload}
                />
              </div>
            </div>
          )}

          <div className="mt-auto bg-white dark:bg-slate-800 p-4 rounded-lg border shadow-sm">
            <div className="text-sm font-semibold mb-2 flex items-center"><Wand2 className="mr-2 h-4 w-4 text-purple-500" /> AI Magic Edit</div>
            <Input
              placeholder="Describe change..."
              className="mb-2"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
            />
            <Button
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white border-0"
              onClick={handleAiEdit}
              disabled={aiLoading}
            >
              {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate"}
            </Button>
          </div>
        </aside>
        <main className="flex-1 bg-slate-200 dark:bg-slate-950 p-8 flex justify-center overflow-auto">
          <div className="bg-white shadow-2xl w-full max-w-[1200px] min-h-[800px] h-fit rounded-md overflow-hidden ring-1 ring-slate-900/5">
            <iframe
              ref={iframeRef}
              className="w-full h-[1200px] border-0"
              title="Editor"
              sandbox="allow-same-origin allow-scripts"
            />
          </div>
        </main>
      </div>
    </div>
  )
}
