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
            return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
        }

        // Fetch the page
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            },
        });

        if (!response.ok) {
            return NextResponse.json({ error: `Failed to fetch page: ${response.statusText}` }, { status: response.status });
        }

        const html = await response.text();
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
            $(element).removeAttr('srcset');
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

        // Process Inline Styles (background-image urls)
        $('[style]').each((_, element) => {
            const style = $(element).attr('style');
            if (style && style.includes('url(')) {
                const newStyle = style.replace(/url\(['"]?([^'")]+)['"]?\)/g, (match, p1) => {
                    return `url('${resolveUrl(p1)}')`;
                });
                $(element).attr('style', newStyle);
            }
        });

        // Remove Scripts
        $('script').remove();

        // Remove iframes if needed, but keeping for now as they might be visual
        // $('iframe').remove();

        return NextResponse.json({
            html: $.html(),
            assets: {
                images,
                styles
            },
            originalUrl: url
        });

    } catch (error) {
        console.error('Clone error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
