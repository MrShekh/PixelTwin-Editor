import { NextResponse } from 'next/server';
import { parseFigmaNode } from '@/lib/figma-mcp';
import { Groq } from 'groq-sdk';

export async function POST(request: Request) {
    try {
        const { url, token } = await request.json();

        if (!url) {
            return NextResponse.json({ error: 'Figma URL is required' }, { status: 400 });
        }

        const figmaToken = token || process.env.FIGMA_TOKEN;
        if (!figmaToken) {
            return NextResponse.json({ error: 'Figma Token is required' }, { status: 401 });
        }

        // Parse Figma URL
        let fileKey = '';
        let nodeId = '';
        try {
            const parsedUrl = new URL(url);
            const pathParts = parsedUrl.pathname.split('/');
            
            // Handle both /file/ and /design/ URL formats
            const typeIndex = pathParts.findIndex(p => p === 'file' || p === 'design');
            if (typeIndex >= 0 && pathParts.length > typeIndex + 1) {
                fileKey = pathParts[typeIndex + 1];
            } else {
                throw new Error('Invalid Figma URL format');
            }

            // Node ID
            nodeId = parsedUrl.searchParams.get('node-id') || '';
            if (nodeId) {
                // Figma search params use hyphens, API uses colons
                nodeId = nodeId.replace('-', ':');
            }
        } catch (e: any) {
            return NextResponse.json({ error: 'Invalid Figma URL format: ' + e.message }, { status: 400 });
        }

        if (!fileKey) {
            return NextResponse.json({ error: 'Could not extract Figma file key from URL' }, { status: 400 });
        }

        console.log(`[Figma Clone] Fetching from Figma API... File: ${fileKey}, Node: ${nodeId}`);

        // Helper to handle rate limits automatically
        const fetchFigmaWithRetry = async (url: string, retries = 2) => {
            for (let i = 0; i <= retries; i++) {
                const res = await fetch(url, { 
                    headers: { 'X-Figma-Token': figmaToken },
                    cache: 'no-store'
                });
                if (res.status === 429 && i < retries) {
                    const retryAfter = res.headers.get('Retry-After');
                    let parsed = parseInt(retryAfter || '');
                    
                    // If it is a huge number, it might be a timestamp, but either way we shouldn't wait.
                    let waitTime = !isNaN(parsed) && parsed > 0 ? parsed * 1000 : 2000;
                    
                    if (waitTime > 10000) {
                        const seconds = Math.round(waitTime / 1000);
                        throw new Error(`Figma API Hard Rate Limit Active. Wait required: ${seconds} seconds. Please use a new Figma Personal Access Token or wait.`);
                    }

                    console.log(`[Figma API] Rate limited (429). Retrying after ${waitTime}ms...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    continue;
                }
                return res;
            }
            return fetch(url, { headers: { 'X-Figma-Token': figmaToken }, cache: 'no-store' });
        };

        // If no nodeId provided, we must get the document structure to find the first frame
        if (!nodeId) {
            const fileRes = await fetchFigmaWithRetry(`https://api.figma.com/v1/files/${fileKey}`);
            
            if (!fileRes.ok) {
                return NextResponse.json({ error: 'Failed to access Figma file. Check permissions or rate limits.' }, { status: fileRes.status });
            }

            const fileData = await fileRes.json();
            try {
                // Find first frame or canvas
                const firstCanvas = fileData.document.children[0];
                const firstFrame = firstCanvas.children.find((c: any) => c.type === 'FRAME' || c.type === 'COMPONENT' || c.type === 'INSTANCE');
                if (firstFrame) {
                    nodeId = firstFrame.id;
                    console.log(`[Figma Clone] No node-id provided, using first frame found: ${nodeId}`);
                } else {
                    nodeId = firstCanvas.id;
                }
            } catch (e) {
                return NextResponse.json({ error: 'Could not find any frames in the Figma document.' }, { status: 400 });
            }
        }

        // 1. Fetch Node JSON Data for structure, text, and colors
        const nodeRes = await fetchFigmaWithRetry(`https://api.figma.com/v1/files/${fileKey}/nodes?ids=${nodeId}`);

        if (!nodeRes.ok) {
            return NextResponse.json({ error: 'Failed to access Figma node JSON. You may have hit a hard rate limit.' }, { status: nodeRes.status });
        }

        const nodeData = await nodeRes.json();
        
        let extractedDetails = "";
        try {
            const node = nodeData.nodes[nodeId].document;
            extractedDetails = parseFigmaNode(node); // Returns compressed string natively
        } catch(e) {
            console.error('Parse error:', e);
            extractedDetails = "Could not parse specific node data.";
        }

        console.log(`[Figma Clone] Sending clean VDOM structure (length: ${extractedDetails.length}) to Groq for translation...`);

        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
        
        const systemPrompt = `You are an expert Frontend Developer. Convert this compressed Pseudo-HTML AST (derived from Figma Auto-Layout) into a highly responsive, complete, clean HTML piece leveraging Tailwind CSS v4.
Crucial Requirements:
1. Output ONLY valid HTML markup using Tailwind classes. Do not use markdown backticks, no explanations. Just the raw HTML.
2. The AST already provides accurate Tailwind skeleton classes in the 'c' attributes (e.g., flex flex-col gap-[24px] pl-[16px] text-[#000000]). Merge and refine these into a clean Tailwind UI layout.
3. Replace <Icon.../> tags with placeholder SVGs (from lucide or similar).
4. Do NOT use absolute positioning. Use the padding/gap logic provided.
5. Return perfectly formatted nested elements.`;

        let chatCompletion;
        try {
            chatCompletion = await groq.chat.completions.create({
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: "Figma JSON Data:\n" + extractedDetails }
                ],
                temperature: 0.1,
                max_tokens: 8000,
            });
        } catch (e: any) {
            console.log(`[Figma Clone] 70B Model hit limit (${e.message}), trying fallback model...`);
            try {
                // Fallback to high-capacity 8b if rate limited (429)
                chatCompletion = await groq.chat.completions.create({
                    model: "llama-3.1-8b-instant", // Much higher free tier limits
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: "Figma JSON Data:\n" + extractedDetails }
                    ],
                    temperature: 0.1,
                    max_tokens: 8000,
                });
            } catch (fallbackError: any) {
                console.error(`[Figma Clone] 8B Fallback Model also failed: ${fallbackError.message}`);
                const err = new Error(`Groq AI Rate Limit Exceeded. Wait a moment and try again. Details: ${fallbackError.message}`);
                (err as any).status = 429;
                throw err;
            }
        }

        let generatedHtml = chatCompletion.choices[0]?.message?.content || "";
        generatedHtml = generatedHtml.replace(/```html/gi, '').replace(/```/g, '').trim();

        console.log(`[Figma Clone] Generation complete. (${generatedHtml.length} bytes)`);

        return NextResponse.json({
            html: generatedHtml,
            stats: { type: "figma_vdom_translation", size: extractedDetails.length }
        });

    } catch (error: any) {
        console.error('[Figma Drop Error]', error);
        const isRateLimit = error?.status === 429 || error?.message?.includes('Rate Limit');
        return NextResponse.json({ 
            error: isRateLimit ? error.message : 'Internal server error while parsing Figma',
            message: error.message || 'Unknown error'
        }, { status: error.status || (isRateLimit ? 429 : 500) });
    }
}
