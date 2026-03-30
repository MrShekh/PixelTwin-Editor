import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import * as cheerio from 'cheerio';

export async function POST(request: Request) {
    try {
        const { prompt, html, elementId } = await request.json();

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        const groqKey = process.env.GROQ_API_KEY;

        if (!groqKey) {
            return NextResponse.json({
                success: false,
                message: "Groq API key not configured. Please add GROQ_API_KEY to your .env file.",
                modifiedHtml: html
            }, { status: 400 });
        }

        // Parse HTML
        const $ = cheerio.load(html);
        let targetHtml = '';
        let isFullPage = true;
        let targetElement = null;

        if (elementId) {
            targetElement = $(`#${elementId}`);
        } else {
            targetElement = $('.pixeltwin-selected').first();
        }

        // Generate a robust unique ID if targeting a specific element
        const uniqueTargetId = `ai-target-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

        if (targetElement && targetElement.length > 0) {
            if (targetElement.is('body')) {
                console.log(`Target is body, switching to full page mode.`);
                targetHtml = $('body').html() || '';
                isFullPage = true;
            } else {
                // Mark element so we can reliably find it after the AI response
                targetElement.attr('data-ai-target-id', uniqueTargetId);
                targetHtml = $.html(targetElement);
                isFullPage = false;
                console.log(`Targeting specific selected element. ID marked: ${uniqueTargetId}`);
            }
        } else {
            console.warn(`No target element selected, falling back to full body.`);
            targetHtml = $('body').html() || '';
        }

        // Check content size
        if (targetHtml.length > 50000) {
            return NextResponse.json({
                success: false,
                message: "Content is too large for AI processing. Please try editing smaller sections.",
                modifiedHtml: html
            }, { status: 413 });
        }

        // Create the AI prompt
        const aiPrompt = isFullPage
            ? `You are a web content editor. Modify the HTML body content below based on the request.
Request: ${prompt}

HTML Body:
${targetHtml}

Return ONLY the modified HTML body content. No markdown. No explanations. Do not include <body> tags.`
            : `You are an expert web content editor. Your task is to modify the HTML element provided below according to the user's request, while preserving its core structure and any 'data-ai-target-id' attribute.
Request: ${prompt}

Target Element HTML:
${targetHtml}

CRITICAL RULES:
1. Return ONLY the modified HTML for this specific element. 
2. Do NOT wrap it in markdown formatting (like \`\`\`html). 
3. Do NOT add any explanations.
4. Keep the outermost tag the same if possible and MUST KEEP the data-ai-target-id attribute.`;

        console.log('Using Groq API for AI editing...');
        console.log('Content length:', targetHtml.length);

        const groq = new Groq({ apiKey: groqKey });

        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: "user",
                    content: aiPrompt
                }
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0.7,
            max_tokens: 8192,
        });

        let modifiedContent = completion.choices[0]?.message?.content;

        if (!modifiedContent || modifiedContent.trim().length === 0) {
            return NextResponse.json({
                success: false,
                message: "AI returned empty content. Please try a different request.",
                modifiedHtml: html // Return original HTML on AI failure instead of throwing unhandled error
            }, { status: 400 });
        }

        // Clean up response
        modifiedContent = modifiedContent.replace(/```html/g, '').replace(/```/g, '').trim();

        // Apply changes
        if (isFullPage) {
            $('body').html(modifiedContent);
        } else {
            // Find the element we marked earlier
            const elToReplace = $(`[data-ai-target-id="${uniqueTargetId}"]`);
            if (elToReplace.length > 0) {
                // Ensure the new content still parses as valid cheerio snippet before replacing
                elToReplace.replaceWith(modifiedContent);
                // After replacing, remove the targeting attribute from the new element if it was kept
                $(`[data-ai-target-id="${uniqueTargetId}"]`).removeAttr('data-ai-target-id');
            } else {
                console.warn("Could not find the target element to replace. Fallback: keeping original HTML.");
            }
        }

        // Clean up any lingering selection/edit state glasses from the AI output
        $('.pixeltwin-selected').removeClass('pixeltwin-selected');
        $('.pixeltwin-editable').removeClass('pixeltwin-editable');
        $('[contenteditable="true"]').removeAttr('contenteditable');

        const finalHtml = $('body').html() || '';

        console.log('✅ Groq API successful');

        return NextResponse.json({
            success: true,
            message: "AI edit applied successfully using Groq!",
            modifiedHtml: finalHtml,
            provider: 'Groq (llama-3.3-70b)'
        });

    } catch (error: any) {
        console.error('=== AI Processing Error ===');
        console.error('Error Type:', error.constructor.name);
        console.error('Error Message:', error.message);
        if (error.error) console.error('Groq Error Details:', JSON.stringify(error.error, null, 2));
        if (error.status) console.error('Status Code:', error.status);

        return NextResponse.json({
            success: false,
            error: error.message || 'AI processing failed.',
            details: error.error || null
        }, { status: 500 });
    }
}
