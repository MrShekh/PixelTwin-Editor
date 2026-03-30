import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export async function POST(request: Request) {
    try {
        const { url } = await request.json();

        if (!url) {
            return NextResponse.json({ error: 'URL is required' }, { status: 400 });
        }

        // Validate URL
        try {
            new URL(url);
        } catch (e) {
            return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
        }

        console.log(`[Clone] Attempting to clone: ${url}`);

        // Try multiple user agents to bypass bot detection
        const userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ];

        let response;
        let lastError;

        // Try with different user agents
        for (const userAgent of userAgents) {
            try {
                response = await fetch(url, {
                    headers: {
                        'User-Agent': userAgent,
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.5',
                        'Accept-Encoding': 'gzip, deflate, br',
                        'DNT': '1',
                        'Connection': 'keep-alive',
                        'Upgrade-Insecure-Requests': '1',
                        'Sec-Fetch-Dest': 'document',
                        'Sec-Fetch-Mode': 'navigate',
                        'Sec-Fetch-Site': 'none',
                        'Cache-Control': 'max-age=0'
                    },
                    redirect: 'follow',
                    signal: AbortSignal.timeout(15000) // 15 second timeout
                });

                if (response.ok) {
                    console.log(`[Clone] Successfully fetched with User-Agent: ${userAgent.substring(0, 50)}...`);
                    break;
                }
            } catch (e: any) {
                lastError = e;
                console.log(`[Clone] Failed with User-Agent ${userAgent.substring(0, 30)}...: ${e.message}`);
                continue;
            }
        }

        if (!response || !response.ok) {
            const errorMsg = response
                ? `Failed to fetch page: ${response.status} ${response.statusText}`
                : `Network error: ${lastError?.message || 'Unable to reach website'}`;

            console.error(`[Clone] ${errorMsg}`);

            return NextResponse.json({
                error: errorMsg,
                suggestion: 'This website may be blocking automated requests. Try using the Upload/Paste HTML option instead.',
                details: {
                    url,
                    status: response?.status,
                    statusText: response?.statusText
                }
            }, { status: response?.status || 500 });
        }

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('text/html')) {
            return NextResponse.json({
                error: `Invalid content type: ${contentType}. Expected HTML.`,
                suggestion: 'Make sure the URL points to a web page, not a file or API endpoint.'
            }, { status: 400 });
        }

        const html = await response.text();

        if (!html || html.trim().length === 0) {
            return NextResponse.json({
                error: 'Received empty response from website',
                suggestion: 'The website may be dynamically rendered with JavaScript. Try the Upload/Paste option.'
            }, { status: 400 });
        }

        console.log(`[Clone] Received ${html.length} bytes of HTML`);

        const $ = cheerio.load(html);

        // Helper to resolve relative URLs
        const resolveUrl = (relativeUrl: string) => {
            try {
                return new URL(relativeUrl, url).href;
            } catch (e) {
                return relativeUrl;
            }
        };

        // Process Images
        const images: { original: string; resolved: string; alt: string }[] = [];
        $('img').each((_, element) => {
            const src = $(element).attr('src');
            if (src) {
                const resolved = resolveUrl(src);
                $(element).attr('src', resolved);
                images.push({
                    original: src,
                    resolved: resolved,
                    alt: $(element).attr('alt') || '',
                });
            }
            // Keep srcset but resolve URLs
            const srcset = $(element).attr('srcset');
            if (srcset) {
                const resolvedSrcset = srcset.split(',').map(src => {
                    const parts = src.trim().split(' ');
                    parts[0] = resolveUrl(parts[0]);
                    return parts.join(' ');
                }).join(', ');
                $(element).attr('srcset', resolvedSrcset);
            }
        });

        console.log(`[Clone] Processed ${images.length} images`);

        // Process background images in style attributes
        $('[style*="background"]').each((_, element) => {
            const style = $(element).attr('style');
            if (style && style.includes('url(')) {
                const newStyle = style.replace(/url\(['"]?([^'")]+)['"]?\)/g, (match, p1) => {
                    return `url('${resolveUrl(p1)}')`;
                });
                $(element).attr('style', newStyle);
            }
        });

        // Process Links (CSS)
        const styles: string[] = [];
        $('link[rel="stylesheet"]').each((_, element) => {
            const href = $(element).attr('href');
            if (href) {
                const resolved = resolveUrl(href);
                $(element).attr('href', resolved);
                styles.push(resolved);
            }
        });

        console.log(`[Clone] Found ${styles.length} stylesheets`);

        // Fetch and inline critical CSS to preserve gradients and styles
        const inlinedStyles: string[] = [];
        const maxStylesheets = 5;

        for (let i = 0; i < Math.min(styles.length, maxStylesheets); i++) {
            const styleUrl = styles[i];
            try {
                console.log(`[Clone] Fetching CSS ${i + 1}/${Math.min(styles.length, maxStylesheets)}: ${styleUrl.substring(0, 60)}...`);

                const cssResponse = await fetch(styleUrl, {
                    headers: {
                        'User-Agent': userAgents[0],
                        'Accept': 'text/css,*/*;q=0.1',
                    },
                    signal: AbortSignal.timeout(5000) // 5 second timeout per CSS file
                });

                if (cssResponse.ok) {
                    let cssText = await cssResponse.text();

                    // Resolve relative URLs in CSS
                    cssText = cssText.replace(/url\(['"]?([^'")]+)['"]?\)/g, (match, p1) => {
                        const cssBaseUrl = styleUrl.substring(0, styleUrl.lastIndexOf('/') + 1);
                        try {
                            return `url('${new URL(p1, cssBaseUrl).href}')`;
                        } catch {
                            return match;
                        }
                    });

                    inlinedStyles.push(`/* Inlined from: ${styleUrl} */\n${cssText}`);
                    console.log(`[Clone] Successfully inlined CSS (${cssText.length} bytes)`);
                } else {
                    console.log(`[Clone] Failed to fetch CSS: ${cssResponse.status} ${cssResponse.statusText}`);
                }
            } catch (e: any) {
                console.error(`[Clone] CSS fetch error for ${styleUrl}: ${e.message}`);
                // Continue with other stylesheets
            }
        }

        // Add inlined styles to the head
        if (inlinedStyles.length > 0) {
            $('head').append(`<style id="pixeltwin-inlined-styles">\n${inlinedStyles.join('\n\n')}\n</style>`);
            console.log(`[Clone] Inlined ${inlinedStyles.length} stylesheets`);
        }

        // Process Inline Styles (preserve all inline styles including gradients)
        $('[style]').each((_, element) => {
            const style = $(element).attr('style');
            if (style) {
                // Ensure style attribute is preserved exactly
                $(element).attr('style', style.trim());
            }
        });

        // Remove Scripts but keep noscript
        const scriptCount = $('script').length;
        $('script').remove();
        console.log(`[Clone] Removed ${scriptCount} scripts`);

        // Process style tags - keep them
        $('style').each((_, element) => {
            const styleContent = $(element).html();
            if (styleContent) {
                // Resolve URLs in style tags
                const newContent = styleContent.replace(/url\(['"]?([^'")]+)['"]?\)/g, (match, p1) => {
                    return `url('${resolveUrl(p1)}')`;
                });
                $(element).html(newContent);
            }
        });

        console.log(`[Clone] Successfully cloned ${url}`);

        return NextResponse.json({
            html: $.html(),
            assets: {
                images,
                styles
            },
            originalUrl: url,
            stats: {
                images: images.length,
                stylesheets: styles.length,
                inlinedStylesheets: inlinedStyles.length,
                scriptsRemoved: scriptCount
            }
        });

    } catch (error: any) {
        console.error('[Clone] Unexpected error:', error);
        return NextResponse.json({
            error: 'Internal server error while cloning',
            message: error.message,
            suggestion: 'This might be a complex website. Try using the Upload/Paste HTML option instead.'
        }, { status: 500 });
    }
}
