import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import * as cheerio from 'cheerio';

export async function POST(request: Request) {
    try {
        const { prompt, outerHTML } = await request.json();

        if (!prompt || !outerHTML) {
            return NextResponse.json({ error: 'Prompt and outerHTML are required' }, { status: 400 });
        }

        const groqKey = process.env.GROQ_API_KEY;

        if (!groqKey) {
            return NextResponse.json({
                success: false,
                message: "Groq API key not configured. Please add GROQ_API_KEY to your .env file.",
                modifiedHtml: outerHTML
            }, { status: 400 });
        }

        // Check content size to be safe, though snippets should be small
        if (outerHTML.length > 50000) {
            return NextResponse.json({
                success: false,
                message: "Selected element is too large for AI snippet processing. Please select a smaller element.",
                modifiedHtml: outerHTML
            }, { status: 413 });
        }

        const aiPrompt = `You are an expert web frontend developer. The user wants to modify a specific HTML element based on a request.
Request: ${prompt}

Original Element HTML:
${outerHTML}

CRITICAL RULES:
1. Return ONLY the modified HTML for this specific element.
2. Ensure you return valid HTML.
3. Keep the outermost tag and format unchanged if possible, unless the prompt specifically asks to change the container type.
4. Do NOT wrap it in markdown formatting (like \`\`\`html) or add explanations. Return the raw HTML string directly.`;

        const groq = new Groq({ apiKey: groqKey });
        const completion = await groq.chat.completions.create({
            messages: [{ role: "user", content: aiPrompt }],
            model: "llama-3.3-70b-versatile",
            temperature: 0.7,
            max_tokens: 8192,
        });

        let modifiedContent = completion.choices[0]?.message?.content;

        if (!modifiedContent || modifiedContent.trim().length === 0) {
            return NextResponse.json({
                success: false,
                message: "AI returned empty content. Please try a different request.",
                modifiedHtml: outerHTML 
            }, { status: 400 });
        }

        // Clean up markdown block if the LLM adds it despite instructions
        modifiedContent = modifiedContent.replace(/```html/g, '').replace(/```/g, '').trim();

        return NextResponse.json({
            success: true,
            message: "AI inline edit applied successfully!",
            modifiedHtml: modifiedContent,
        });

    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message || 'AI snippet processing failed.',
            details: error.error || null
        }, { status: 500 });
    }
}
