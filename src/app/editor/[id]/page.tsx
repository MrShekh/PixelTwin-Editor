"use client"
import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { useSession, signIn, signOut } from 'next-auth/react'
import { getProject, Project, saveProject } from '@/lib/project-manager'
import { Button } from '@/components/ui/button'
import { Loader2, Save, Undo, Redo, Wand2, Image as ImageIcon, Type, Download, Rocket, Github, MousePointerClick, FormInput, Square, Sparkles, Bold, AlignCenter, Palette, LogIn, LogOut } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { exportProjectAsZip } from '@/lib/export-utils'
import Image from 'next/image'
import logo from '@/assets/logo.png'
export default function EditorPage() {
  const params = useParams()
  const { data: session, status: authStatus } = useSession()
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [isIframeLoaded, setIsIframeLoaded] = useState(false)
  const [aiPrompt, setAiPrompt] = useState("")
  const [aiLoading, setAiLoading] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [selectedTag, setSelectedTag] = useState<string | null>(null)

  // Undo / Redo History
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)

  // Floating AI Popup state
  const [aiPopup, setAiPopup] = useState<{
    visible: boolean;
    x: number;
    y: number;
    outerHTML: string;
    ptId: string;
    tagName: string;
  } | null>(null);
  const [aiSnippetPrompt, setAiSnippetPrompt] = useState("");
  const [aiSnippetLoading, setAiSnippetLoading] = useState(false);
  const [integrationInput, setIntegrationInput] = useState("");

  // Load project
  useEffect(() => {
    if (params.id) {
      const loadProject = async () => {
        const p = await getProject(params.id as string)
        setProject(p)
        setLoading(false)
      }
      loadProject()
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
              ${project.css?.map(href => `<link rel="stylesheet" href="${href}">`).join('\n') || ''}
              <style>
                .pixeltwin-hover { outline: 2px dashed #93c5fd !important; background-color: rgba(59, 130, 246, 0.05) !important; cursor: default !important; }
                .pixeltwin-selected { outline: 2px solid #f97316 !important; }
                .pixeltwin-editable {
                  user-select: text !important;
                  -webkit-user-select: text !important;
                  outline: 3px solid #3b82f6 !important;
                  outline-offset: 4px !important;
                  background-color: #ffffff !important;
                  color: #000000 !important;
                  box-shadow: 0 4px 12px rgba(0,0,0,0.1) !important;
                  border-radius: 4px !important;
                  cursor: text !important;
                  z-index: 99999 !important;
                  position: relative !important;
                  min-width: 50px !important;
                  display: inline-block !important;
                }
                body { padding-bottom: 100px; } /* Space for scrolling */
              </style>
            </head>
            <body>
              ${project.html}
              <script>
                // Intercept all clicks to prevent link navigation
                window.addEventListener('click', (e) => {
                  const link = e.target.closest('a');
                  if (link) { e.preventDefault(); }
                }, true);

                // Editor Script
                document.body.addEventListener('mouseover', (e) => {
                  e.stopPropagation();
                  if (e.target === document.body) return;
                  if (e.target.isContentEditable) return; // Don't hover if we're actively typing
                  e.target.classList.add('pixeltwin-hover');
                });
                
                document.body.addEventListener('mouseout', (e) => {
                  e.stopPropagation();
                  e.target.classList.remove('pixeltwin-hover');
                });
                
                // Single click to select
                document.body.addEventListener('click', (e) => {
                  e.stopPropagation();
                  
                  // Ensure element gets a unique tracking ID
                  if (!e.target.hasAttribute('data-pt-id')) {
                    e.target.setAttribute('data-pt-id', 'pt-' + Date.now() + Math.random().toString(36).substring(2, 9));
                  }
                  const ptId = e.target.getAttribute('data-pt-id');
                  const rect = e.target.getBoundingClientRect();

                  // Notify parent
                  const tagName = e.target.tagName.toUpperCase();
                  if (tagName === 'IMG') {
                     window.parent.postMessage({ type: 'IMAGE_SELECTED', src: e.target.src, tagName, rect, ptId, outerHTML: e.target.outerHTML }, '*');
                  } else {
                     window.parent.postMessage({ type: 'ELEMENT_CLICK', tagName, rect, ptId, outerHTML: e.target.outerHTML }, '*');
                  }

                  // If element is currently being edited, don't interfere with the click
                  if (e.target.isContentEditable) {
                    return; 
                  }
                  
                  // Selection visual reset
                  document.querySelectorAll('.pixeltwin-selected, .pixeltwin-editable').forEach(el => {
                    el.classList.remove('pixeltwin-selected', 'pixeltwin-editable');
                    if (el.getAttribute('contenteditable') === 'true') {
                      el.removeAttribute('contenteditable');
                    }
                  });
                  
                  e.target.classList.add('pixeltwin-selected');
                });

                // Double click to tightly focus and edit text
                document.body.addEventListener('dblclick', (e) => {
                  e.stopPropagation();
                  e.preventDefault();

                  const tagName = e.target.tagName.toUpperCase();
                  const textTags = ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'SPAN', 'DIV', 'A', 'LI', 'BUTTON', 'LABEL', 'EM', 'STRONG', 'I', 'B'];
                  
                  if (textTags.includes(tagName)) {
                     // Aggressively override styles that might prevent selection or typing
                     e.target.style.setProperty('user-select', 'text', 'important');
                     e.target.style.setProperty('-webkit-user-select', 'text', 'important');
                     e.target.style.setProperty('pointer-events', 'auto', 'important');
                     
                     e.target.contentEditable = 'true';
                     e.target.classList.add('pixeltwin-editable');
                     e.target.focus();
                     
                     // Move cursor to the end or where clicked if possible
                     try {
                        const range = document.createRange();
                        const sel = window.getSelection();
                        range.selectNodeContents(e.target);
                        range.collapse(false);
                        sel.removeAllRanges();
                        sel.addRange(range);
                     } catch(err) {}
                  }
                });
                
                // Sync changes back to parent
                const sendUpdate = () => {
                  window.parent.postMessage({ type: 'CONTENT_UPDATE', html: document.body.innerHTML }, '*');
                };

                const observer = new MutationObserver(() => {
                   sendUpdate();
                });
                observer.observe(document.body, { subtree: true, childList: true, characterData: true });

                // Ensure typing changes are synced when losing focus
                document.body.addEventListener('focusout', (e) => {
                  if (e.target.isContentEditable) {
                     sendUpdate();
                     e.target.removeAttribute('contenteditable');
                     e.target.classList.remove('pixeltwin-editable');
                  }
                });

                // Drag and drop handlers
                document.body.addEventListener('dragover', (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  document.querySelectorAll('.pixeltwin-selected').forEach(el => el.classList.remove('pixeltwin-selected'));
                  if (e.target !== document.body) e.target.classList.add('pixeltwin-selected');
                });

                document.body.addEventListener('drop', (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const html = e.dataTransfer.getData('text/html');
                  if (html) {
                    const el = document.createElement('div');
                    el.innerHTML = html;
                    const newElement = el.firstElementChild;
                    
                    if (e.target === document.body) {
                        e.target.appendChild(newElement);
                    } else {
                        // Check if we dropped on the top/left or bottom/right half of the target
                        const rect = e.target.getBoundingClientRect();
                        const isTopHalf = (e.clientY - rect.top) < (rect.height / 2);
                        
                        if (isTopHalf) {
                            e.target.parentNode.insertBefore(newElement, e.target);
                        } else {
                            e.target.parentNode.insertBefore(newElement, e.target.nextSibling);
                        }
                    }
                    
                    window.parent.postMessage({ type: 'CONTENT_UPDATE', html: document.body.innerHTML }, '*');
                  }
                });

                // Keyboard shortcuts (Delete & Escape)
                window.addEventListener('keydown', (e) => {
                  if (document.activeElement && document.activeElement.isContentEditable) {
                      if (e.key === 'Escape') {
                         document.activeElement.blur();
                      }
                      return; // Don't trigger outer shortcuts while typing
                  }

                  if (e.key === 'Delete' || e.key === 'Backspace') {
                     const selected = document.querySelector('.pixeltwin-selected');
                     if (selected && selected !== document.body) {
                        e.preventDefault();
                        selected.remove();
                        window.parent.postMessage({ type: 'CONTENT_UPDATE', html: document.body.innerHTML }, '*');
                     }
                  }
                });

                // Listen for updates from parent
                window.addEventListener('message', (event) => {
                  if (event.data.type === 'UPDATE_SELECTED_IMAGE') {
                    const selected = document.querySelector('.pixeltwin-selected');
                    if (selected && selected.tagName === 'IMG') {
                      selected.src = event.data.src;
                      // Trigger content update
                      window.parent.postMessage({ type: 'CONTENT_UPDATE', html: document.body.innerHTML }, '*');
                    }
                  } else if (event.data.type === 'UPDATE_HTML') {
                    document.body.innerHTML = event.data.html;
                  } else if (event.data.type === 'REPLACE_ELEMENT') {
                    const el = document.querySelector('[data-pt-id="' + event.data.ptId + '"]');
                    if (el && event.data.html) {
                       el.outerHTML = event.data.html;
                       // Ensure the new body state is sent to React
                       window.parent.postMessage({ type: 'CONTENT_UPDATE', html: document.body.innerHTML }, '*');
                    }
                  } else if (event.data.type === 'APPLY_STYLE') {
                    const el = document.querySelector('[data-pt-id="' + event.data.ptId + '"]');
                    if (el) {
                       el.style.setProperty(event.data.styleProp, event.data.styleValue, 'important');
                       window.parent.postMessage({ type: 'CONTENT_UPDATE', html: document.body.innerHTML }, '*');
                    }
                  } else if (event.data.type === 'ADD_ELEMENT') {
                    const selected = document.querySelector('.pixeltwin-selected') || document.body;
                    const el = document.createElement('div');
                    el.innerHTML = event.data.html;
                    selected.appendChild(el.firstElementChild);
                    window.parent.postMessage({ type: 'CONTENT_UPDATE', html: document.body.innerHTML }, '*');
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
          const newHtml = e.data.html;
          setProject(prev => prev ? ({ ...prev, html: newHtml }) : null)

          // Add to history
          setHistory(prev => {
            const newHistory = prev.slice(0, historyIndex + 1);
            // Prevent duplicate consecutive states
            if (newHistory[newHistory.length - 1] === newHtml) return prev;
            newHistory.push(newHtml);
            setHistoryIndex(newHistory.length - 1);
            return newHistory;
          });
        }
      } else if (e.data.type === 'IMAGE_SELECTED' || e.data.type === 'ELEMENT_CLICK') {
        if (e.data.type === 'IMAGE_SELECTED') setSelectedImage(e.data.src);
        else setSelectedImage(null);
        setSelectedTag(e.data.tagName);

        if (iframeRef.current && e.data.rect && e.data.ptId && e.data.outerHTML) {
          const iframeRect = iframeRef.current.getBoundingClientRect();
          setAiPopup({
            visible: true,
            x: iframeRect.left + e.data.rect.right + 16,
            y: iframeRect.top + e.data.rect.top,
            outerHTML: e.data.outerHTML,
            ptId: e.data.ptId,
            tagName: e.data.tagName
          });
          // Focus is handled by AutoFocus input
        }
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [project])

  // Setup Initial History
  useEffect(() => {
    if (project && history.length === 0) {
      setHistory([project.html]);
      setHistoryIndex(0);
    }
  }, [project, history.length])

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      const prevHtml = history[prevIndex];
      setHistoryIndex(prevIndex);
      setProject(prev => prev ? { ...prev, html: prevHtml } : null);
      iframeRef.current?.contentWindow?.postMessage({ type: 'UPDATE_HTML', html: prevHtml }, '*');
    }
  }

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      const nextHtml = history[nextIndex];
      setHistoryIndex(nextIndex);
      setProject(prev => prev ? { ...prev, html: nextHtml } : null);
      iframeRef.current?.contentWindow?.postMessage({ type: 'UPDATE_HTML', html: nextHtml }, '*');
    }
  }

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

  const handleDeployVercel = async () => {
    if (!project) return;
    try {
      alert("Deploying to Vercel...");
      const res = await fetch('/api/deploy/vercel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          html: project.html,
          projectName: project.name || 'pixeltwin-deploy'
        })
      });
      const data = await res.json();
      if (data.url) {
        alert(`Successfully deployed to Vercel! URL: ${data.url}`);
        window.open(data.url, '_blank');
      } else {
        alert(data.error || 'Vercel Deployment failed');
      }
    } catch (e) {
      alert("Deployment failed");
    }
  }

  const handleDeployGithub = async () => {
    if (!project) return;
    try {
      const repoName = prompt("Enter a repository name for GitHub:");
      if (!repoName) return;

      alert(`Deploying to GitHub repository: ${repoName}...`);
      const res = await fetch('/api/github/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          html: project.html,
          repoName: repoName,
          message: 'Deploy from PixelTwin Editor'
        })
      });
      const data = await res.json();
      if (data.repoUrl) {
        alert(`Successfully pushed to GitHub! URL: ${data.repoUrl}`);
        window.open(data.repoUrl, '_blank');
      } else {
        alert(data.error || 'GitHub Deployment failed');
      }
    } catch (e) {
      alert("Deployment failed");
    }
  }

  // AI Provider status
  const [aiProvider, setAiProvider] = useState<string>('')

  // Helper: Try Puter/Claude first
  const tryPuterAI = async (prompt: string): Promise<string | null> => {
    try {
      const puter = (window as any).puter;
      if (!puter) return null;

      const response = await puter.ai.chat(prompt, { model: 'claude-sonnet-4-6' });
      const text = response?.message?.content?.[0]?.text;
      if (!text) return null;

      return text.replace(/```html/g, '').replace(/```/g, '').trim();
    } catch (e: any) {
      console.warn('Puter/Claude failed:', e.message || e);
      return null;
    }
  }

  // Helper: Fallback to Groq backend
  const tryGroqAPI = async (endpoint: string, body: object): Promise<any> => {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return await res.json();
  }

  const handleAiEdit = async () => {
    if (!aiPrompt || !project || !iframeRef.current) return;
    setAiLoading(true);
    setAiProvider('');

    try {
      const doc = iframeRef.current.contentDocument;
      if (!doc) throw new Error("Iframe not loaded.");

      const selectedEl = doc.querySelector('.pixeltwin-selected');
      let targetHtml = '';
      let isFullPage = true;
      let uniqueId = '';

      if (selectedEl) {
        isFullPage = false;
        uniqueId = 'ai-target-' + Date.now();
        selectedEl.setAttribute('data-ai-target-id', uniqueId);
        targetHtml = selectedEl.outerHTML;
      } else {
        targetHtml = doc.body.innerHTML;
      }

      let modifiedContent: string | null = null;

      // ── Try 1: Puter / Claude (200K context, better quality) ──
      setAiProvider('Trying Claude…');
      const claudePrompt = isFullPage
        ? `You are a web content editor. Modify the HTML body content below based on the request.\nRequest: ${aiPrompt}\n\nHTML Body:\n${targetHtml}\n\nReturn ONLY the modified HTML body content. No markdown. No explanations.`
        : `You are an expert web content editor. Modify the HTML element below according to the request, preserving the data-ai-target-id attribute.\nRequest: ${aiPrompt}\n\nTarget Element HTML:\n${targetHtml}\n\nReturn ONLY the modified HTML. No markdown. Keep the data-ai-target-id="${uniqueId}" attribute.`;

      modifiedContent = await tryPuterAI(claudePrompt);

      // ── Try 2: Groq fallback (fast, free, 8K output) ──
      if (!modifiedContent) {
        setAiProvider('Falling back to Groq…');

        if (targetHtml.length > 80000) {
          alert("Content too large for Groq. Please select a smaller element.");
          if (uniqueId) selectedEl?.removeAttribute('data-ai-target-id');
          setAiLoading(false);
          setAiProvider('');
          return;
        }

        const data = await tryGroqAPI('/api/ai', { prompt: aiPrompt, html: targetHtml });
        modifiedContent = data.modifiedHtml;
        if (!modifiedContent) throw new Error(data.message || data.error || 'Both AI providers failed');
        setAiProvider('Groq ✓');
      } else {
        setAiProvider('Claude ✓');
      }

      // Apply the result
      if (isFullPage) {
        doc.body.innerHTML = modifiedContent;
      } else {
        const elToReplace = doc.querySelector(`[data-ai-target-id="${uniqueId}"]`);
        if (elToReplace) {
          elToReplace.outerHTML = modifiedContent;
          const newEl = doc.querySelector(`[data-ai-target-id="${uniqueId}"]`);
          if (newEl) newEl.removeAttribute('data-ai-target-id');
        }
      }

      doc.querySelectorAll('.pixeltwin-selected').forEach(e => e.classList.remove('pixeltwin-selected'));
      doc.querySelectorAll('.pixeltwin-editable').forEach(e => e.classList.remove('pixeltwin-editable'));

      setProject({ ...project, html: doc.body.innerHTML });
      setAiPrompt("");

      // Clear provider indicator after 3s
      setTimeout(() => setAiProvider(''), 3000);

    } catch (e: any) {
      alert("AI Edit Failed: " + (e.message || "Unknown error"));
      setAiProvider('');
    } finally {
      setAiLoading(false);
    }
  }

  const handleInlineSnippetAiEdit = async (overridePrompt?: string | React.MouseEvent | React.KeyboardEvent) => {
    const isOverrideStr = typeof overridePrompt === 'string';
    const promptToUse = isOverrideStr ? overridePrompt : aiSnippetPrompt;
    
    if (!promptToUse || !aiPopup || !iframeRef.current) return;
    setAiSnippetLoading(true);
    setAiProvider('');

    try {
      let modifiedHtml: string | null = null;

      // ── Try 1: Puter / Claude ──
      setAiProvider('Trying Claude…');
      const claudePrompt = `You are an expert web frontend developer. Modify this HTML element based on the request.\nRequest: ${promptToUse}\n\nOriginal Element HTML:\n${aiPopup.outerHTML}\n\nReturn ONLY the modified HTML. No markdown. No explanations.`;

      modifiedHtml = await tryPuterAI(claudePrompt);

      // ── Try 2: Groq fallback ──
      if (!modifiedHtml) {
        setAiProvider('Falling back to Groq…');
        const data = await tryGroqAPI('/api/ai/snippet', {
          prompt: promptToUse,
          outerHTML: aiPopup.outerHTML
        });

        if (data.modifiedHtml && data.success) {
          modifiedHtml = data.modifiedHtml;
          setAiProvider('Groq ✓');
        } else {
          throw new Error(data.message || data.error || 'Both AI providers failed');
        }
      } else {
        setAiProvider('Claude ✓');
      }

      iframeRef.current.contentWindow?.postMessage({
        type: 'REPLACE_ELEMENT',
        ptId: aiPopup.ptId,
        html: modifiedHtml
      }, '*');
      setAiPopup((prev) => prev ? { ...prev, visible: false } : null);
      if (!isOverrideStr) setAiSnippetPrompt("");
      setIntegrationInput("");

      setTimeout(() => setAiProvider(''), 3000);

    } catch (e: any) {
      alert("AI Edit Failed: " + (e.message || "Unknown error"));
      setAiProvider('');
    } finally {
      setAiSnippetLoading(false);
    }
  }

  const handleQuickStyle = (styleProp: string, styleValue: string) => {
    if (!aiPopup || !iframeRef.current) return;
    iframeRef.current.contentWindow?.postMessage({
      type: 'APPLY_STYLE',
      ptId: aiPopup.ptId,
      styleProp,
      styleValue
    }, '*');
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

  if (loading) return (
    <div className="flex h-screen items-center justify-center" style={{ background: 'var(--bg-base)' }}>
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="animate-spin w-7 h-7" style={{ color: 'var(--accent)' }} />
        <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Loading project…</span>
      </div>
    </div>
  )
  if (!project) return (
    <div className="flex h-screen items-center justify-center" style={{ background: 'var(--bg-base)' }}>
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Project not found</p>
    </div>
  )

  const toolItems = [
    { label: 'Text', icon: Type, html: '<p style="font-size:16px;color:#1C1410;margin:8px 0">New Text</p>' },
    { label: 'Image', icon: ImageIcon, html: '<img src="https://placehold.co/400x200/FDF0EA/E8612A?text=Image" alt="Placeholder" style="max-width:100%" />' },
    { label: 'Button', icon: MousePointerClick, html: '<button style="padding:10px 20px;background:#E8612A;color:#fff;border-radius:8px;border:none;font-size:14px;font-weight:600;cursor:pointer">Button</button>' },
    { label: 'Input', icon: FormInput, html: '<input type="text" placeholder="Type here…" style="padding:10px 14px;border:1.5px solid #E8E1D9;border-radius:8px;font-size:14px;outline:none;background:#FBF9F6" />' },
    { label: 'Box', icon: Square, html: '<div style="width:120px;height:80px;background:#FDF0EA;border:2px dashed #F2C4A8;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:12px;color:#9C8B7E">Box</div>' },
  ]

  return (
    <div className="flex h-screen flex-col" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>

      {/* ── Header ── */}
      <header className="flex items-center justify-between px-5 py-2.5 shrink-0"
        style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>

        <div className="flex items-center gap-3">
          <div className="flex items-center">
            <Image src={logo} alt="PixelTwin Logo" style={{ height: '28px', width: 'auto' }} priority />
          </div>
          {project.name && (
            <span className="text-xs px-2.5 py-1 rounded-full font-medium"
              style={{ background: 'var(--accent-light)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}>
              {project.name}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button onClick={handleUndo} disabled={historyIndex <= 0}
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-all disabled:opacity-35"
            style={{ border: '1px solid var(--border)', background: 'var(--bg-card)' }}
            title="Undo">
            <Undo className="w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />
          </button>
          <button onClick={handleRedo} disabled={historyIndex >= history.length - 1}
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-all disabled:opacity-35"
            style={{ border: '1px solid var(--border)', background: 'var(--bg-card)' }}
            title="Redo">
            <Redo className="w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />
          </button>

          <div className="w-px h-5 mx-1" style={{ background: 'var(--border)' }} />

          <button onClick={handleSave}
            className="flex items-center gap-1.5 px-3.5 h-8 rounded-lg text-xs font-semibold transition-all"
            style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
            <Save className="w-3.5 h-3.5" /> Save
          </button>
          <button onClick={handleExport}
            className="flex items-center gap-1.5 px-3.5 h-8 rounded-lg text-xs font-semibold transition-all"
            style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
            <Download className="w-3.5 h-3.5" /> Export
          </button>

          <div className="w-px h-5 mx-1" style={{ background: 'var(--border)' }} />

          {session ? (
            <>
              <button onClick={handleDeployVercel}
                className="flex items-center gap-1.5 px-3.5 h-8 rounded-lg text-xs font-semibold transition-all text-white"
                style={{ background: '#000' }}>
                <Rocket className="w-3.5 h-3.5" /> Vercel
              </button>
              <button onClick={handleDeployGithub}
                className="flex items-center gap-1.5 px-3.5 h-8 rounded-lg text-xs font-semibold transition-all text-white"
                style={{ background: '#24292e' }}>
                <Github className="w-3.5 h-3.5" /> GitHub
              </button>

              <div className="w-px h-5 mx-1" style={{ background: 'var(--border)' }} />

              <div className="flex items-center gap-2">
                {session.user?.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={session.user.image} alt="" className="w-6 h-6 rounded-full" style={{ border: '1.5px solid var(--border)' }} />
                )}
                <span className="text-[11px] font-medium max-w-[80px] truncate" style={{ color: 'var(--text-secondary)' }}>
                  {session.user?.name || 'User'}
                </span>
                <button onClick={() => signOut()}
                  className="flex items-center justify-center w-7 h-7 rounded-lg transition-all"
                  style={{ border: '1px solid var(--border)', background: 'var(--bg-card)' }}
                  title="Sign out">
                  <LogOut className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
                </button>
              </div>
            </>
          ) : (
            <button onClick={() => signIn('github')}
              className="flex items-center gap-1.5 px-4 h-8 rounded-lg text-xs font-semibold transition-all text-white"
              style={{ background: '#24292e' }}>
              <LogIn className="w-3.5 h-3.5" /> Sign in with GitHub
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* ── Sidebar ── */}
        <aside className="w-64 shrink-0 flex flex-col overflow-y-auto"
          style={{ background: 'var(--bg-sidebar)', borderRight: '1px solid var(--border)' }}>

          {/* Elements */}
          <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
              Elements
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {toolItems.map(({ label, icon: Icon, html }) => (
                <button
                  key={label}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/html', html)}
                  onClick={() => iframeRef.current?.contentWindow?.postMessage({ type: 'ADD_ELEMENT', html }, '*')}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium transition-all cursor-grab active:cursor-grabbing group"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-border)';
                    (e.currentTarget as HTMLElement).style.background = 'var(--accent-light)';
                    (e.currentTarget as HTMLElement).style.color = 'var(--accent)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
                    (e.currentTarget as HTMLElement).style.background = 'var(--bg-card)';
                    (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                  }}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Selection info */}
          {selectedTag && (
            <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)' }}>Selected</p>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono font-medium"
                style={{ background: 'var(--accent-light)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}>
                <span className="w-1.5 h-1.5 rounded-full shrink-0 pulse-dot" style={{ background: 'var(--accent)' }} />
                &lt;{selectedTag.toLowerCase()}&gt;
              </div>
              <p className="text-[10px] mt-1.5" style={{ color: 'var(--text-muted)' }}>Click element → use popup to edit</p>
            </div>
          )}

          {/* Image Editor */}
          {selectedImage && (
            <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Image</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={selectedImage} alt="Selected" className="w-full aspect-video object-contain rounded-lg mb-2"
                style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)' }} />
              <div className="relative">
                <button className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                  <ImageIcon className="w-3.5 h-3.5" /> Replace Image
                </button>
                <input type="file" accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleImageUpload} />
              </div>
            </div>
          )}

          {/* AI Magic Edit – Sidebar */}
          <div className="p-4 mt-auto">
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
              AI Page Edit
            </p>
            <div className="rounded-xl p-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <textarea
                placeholder="Describe a global change to the page…"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                rows={3}
                className="w-full resize-none text-xs rounded-lg p-2.5 mb-2.5 outline-none"
                style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border)', color: 'var(--text-primary)', caretColor: 'var(--accent)' }}
              />
              <button
                onClick={handleAiEdit}
                disabled={aiLoading || !aiPrompt.trim()}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold text-white transition-all disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, var(--accent), #F59E0B)' }}>
                {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                {aiProvider ? aiProvider : (aiLoading ? 'Working…' : 'Apply with AI')}
              </button>
            </div>
          </div>
        </aside>

        {/* ── Canvas ── */}
        <main className="flex-1 flex justify-center items-start overflow-auto p-6"
          style={{ background: 'var(--bg-hover)' }}>
          {/* subtle grid */}
          <div className="absolute inset-0 pointer-events-none opacity-30"
            style={{ backgroundImage: 'radial-gradient(circle, var(--border-strong) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
          <div className="relative w-full max-w-[1280px]">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#FF5F56' }} />
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#FFBD2E' }} />
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#27C93F' }} />
              </div>
              <div className="flex-1 h-6 rounded-md flex items-center px-3"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <span className="text-[10px] font-mono truncate" style={{ color: 'var(--text-muted)' }}>
                  {project.originalUrl || 'pixeltwin-canvas'}
                </span>
              </div>
            </div>
            <div className="rounded-xl overflow-hidden" style={{ boxShadow: 'var(--shadow-xl)', border: '1px solid var(--border)' }}>
              <iframe
                ref={iframeRef}
                className="w-full border-0 block"
                style={{ minHeight: '1200px', height: '1200px' }}
                title="Editor Canvas"
                sandbox="allow-same-origin allow-scripts"
              />
            </div>
          </div>
        </main>
      </div>

      {/* ── Floating AI Popup ── */}
      {aiPopup && aiPopup.visible && (
        <div
          className="fixed z-50 w-72"
          style={{
            left: Math.min(aiPopup.x, window.innerWidth - 300) + 'px',
            top: Math.max(20, Math.min(aiPopup.y, window.innerHeight - 280)) + 'px',
          }}
        >
          <div className="rounded-2xl overflow-hidden"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-xl)' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-sidebar)' }}>
              <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                <Wand2 className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
                Edit Element &nbsp;
                <code className="px-1.5 py-0.5 rounded text-[10px] font-mono"
                  style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
                  {aiPopup.tagName.toLowerCase()}
                </code>
              </div>
              <button
                onClick={() => setAiPopup(prev => prev ? { ...prev, visible: false } : null)}
                className="w-5 h-5 rounded-full flex items-center justify-center text-xs transition-all"
                style={{ color: 'var(--text-muted)', background: 'var(--bg-hover)' }}>
                ×
              </button>
            </div>

            <div className="p-4">
              {/* Quick styles */}
              <div className="flex gap-1.5 mb-4">
                {[
                  { label: '𝐁 Bold', prop: 'font-weight', val: 'bold' },
                  { label: '≡ Center', prop: 'text-align', val: 'center' },
                  { label: '🔴 Red', prop: 'color', val: '#ef4444' },
                  { label: '↑ Large', prop: 'font-size', val: '1.25em' },
                ].map(({ label, prop, val }) => (
                  <button key={label} onClick={() => handleQuickStyle(prop, val)}
                    className="flex-1 text-[10px] py-1.5 rounded-lg font-medium transition-all truncate"
                    style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                    onMouseEnter={e => {
                      (e.currentTarget).style.background = 'var(--accent-light)';
                      (e.currentTarget).style.color = 'var(--accent)';
                      (e.currentTarget).style.borderColor = 'var(--accent-border)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget).style.background = 'var(--bg-sidebar)';
                      (e.currentTarget).style.color = 'var(--text-secondary)';
                      (e.currentTarget).style.borderColor = 'var(--border)';
                    }}
                  >{label}</button>
                ))}
              </div>

              {/* Dynamic Backend Integrations */}
              {['FORM', 'A', 'IMG', 'DIV', 'SECTION'].includes(aiPopup.tagName) && (
                <div className="mb-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                    {aiPopup.tagName === 'FORM' ? 'Add Form Backend' : 'Add Dynamic Link/Map'}
                  </p>
                  <div className="flex gap-2">
                    <input
                      type={aiPopup.tagName === 'FORM' ? "email" : "text"}
                      placeholder={
                        aiPopup.tagName === 'FORM' ? "Email to receive submissions" :
                        ['A', 'IMG'].includes(aiPopup.tagName) ? "Link URL or WhatsApp number (e.g. +12...)" :
                        "Map Location (e.g. New York)"
                      }
                      value={integrationInput}
                      onChange={(e) => setIntegrationInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          let prompt = "";
                          if (aiPopup.tagName === 'FORM') {
                             prompt = `Make this form functional. Set the action to "https://formsubmit.co/${integrationInput}" and method="POST". Ensure every <input>, <textarea>, and <select> has a valid 'name' attribute. Preserving existing styling exactly.`;
                          } else if (['A', 'IMG'].includes(aiPopup.tagName)) {
                             let link = integrationInput;
                             if (/^[+0-9\s-]+$/.test(integrationInput) && integrationInput.replace(/[^0-9]/g, '').length >= 7) {
                               link = `https://wa.me/${integrationInput.replace(/[^0-9]/g, '')}`;
                             }
                             prompt = `Make this element a functional link. If it's an <img>, wrap it in an <a> tag. Set the href to "${link}". Ensure target="_blank" is used. Preserve all styling on the inner element.`;
                          } else {
                             prompt = `Replace the inner content of this container with a responsive Google Maps iframe (width 100%, min-height 300px, border 0) pointing to the location: "${integrationInput}". Use the URL format: https://maps.google.com/maps?q=${encodeURIComponent(integrationInput)}&output=embed. Preserve container styling.`;
                          }
                          handleInlineSnippetAiEdit(prompt);
                        }
                      }}
                      className="flex-1 rounded-lg px-3 py-2 text-xs outline-none"
                      style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border)', color: 'var(--text-primary)', caretColor: 'var(--accent)' }}
                    />
                    <button
                      disabled={aiSnippetLoading || !integrationInput.trim()}
                      onClick={() => {
                        let prompt = "";
                        if (aiPopup.tagName === 'FORM') {
                           prompt = `Make this form functional. Set the action to "https://formsubmit.co/${integrationInput}" and method="POST". Ensure every <input>, <textarea>, and <select> has a valid 'name' attribute. Preserving existing styling exactly.`;
                        } else if (['A', 'IMG'].includes(aiPopup.tagName)) {
                           let link = integrationInput;
                           if (/^[+0-9\s-]+$/.test(integrationInput) && integrationInput.replace(/[^0-9]/g, '').length >= 7) {
                             link = `https://wa.me/${integrationInput.replace(/[^0-9]/g, '')}`;
                           }
                           prompt = `Make this element a functional link. If it's an <img>, wrap it in an <a> tag. Set the href to "${link}". Ensure target="_blank" is used. Preserve all styling on the inner element.`;
                        } else {
                           prompt = `Replace the inner content of this container with a responsive Google Maps iframe (width 100%, min-height 300px, border 0) pointing to the location: "${integrationInput}". Use the URL format: https://maps.google.com/maps?q=${encodeURIComponent(integrationInput)}&output=embed. Preserve container styling.`;
                        }
                        handleInlineSnippetAiEdit(prompt);
                      }}
                      className="px-3 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 text-white flex items-center justify-center whitespace-nowrap"
                      style={{ background: 'var(--accent)' }}>
                      {aiSnippetLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Apply'}
                    </button>
                  </div>
                </div>
              )}

              {/* AI prompt */}
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                AI Magic Edit
              </p>
              <input
                autoFocus
                type="text"
                placeholder="Change this to…"
                value={aiSnippetPrompt}
                onChange={(e) => setAiSnippetPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleInlineSnippetAiEdit();
                  if (e.key === 'Escape') setAiPopup(prev => prev ? { ...prev, visible: false } : null);
                }}
                className="w-full rounded-lg px-3 py-2.5 text-xs mb-3 outline-none"
                style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border)', color: 'var(--text-primary)', caretColor: 'var(--accent)' }}
              />

              <div className="flex gap-2">
                <button
                  onClick={() => setAiPopup(prev => prev ? { ...prev, visible: false } : null)}
                  className="flex-1 py-2 rounded-lg text-xs font-medium transition-all"
                  style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                  Cancel
                </button>
                <button
                  onClick={handleInlineSnippetAiEdit}
                  disabled={aiSnippetLoading || !aiSnippetPrompt.trim()}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 text-white flex items-center justify-center gap-1.5"
                  style={{ background: 'linear-gradient(135deg, var(--accent), #F59E0B)' }}>
                  {aiSnippetLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  {aiProvider ? aiProvider : (aiSnippetLoading ? 'Working…' : 'Apply')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

