import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { html, projectName, repoUrl } = await req.json();

        if (!html || !projectName) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const netlifyToken = process.env.NETLIFY_TOKEN;

        if (!netlifyToken) {
            return NextResponse.json({
                error: 'Netlify token not configured. Please add NETLIFY_TOKEN to your environment variables.'
            }, { status: 500 });
        }

        const siteName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-');

        // If GitHub repo URL is provided, create a site linked to the repo
        if (repoUrl) {
            // First, create a site
            const createSiteResponse = await fetch('https://api.netlify.com/api/v1/sites', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${netlifyToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: siteName,
                    repo: {
                        provider: 'github',
                        repo: repoUrl.replace('https://github.com/', ''),
                        branch: 'main',
                        cmd: '',
                        dir: '/'
                    }
                })
            });

            const siteData = await createSiteResponse.json();

            if (!createSiteResponse.ok) {
                console.error('Netlify site creation error:', siteData);
                return NextResponse.json({
                    error: siteData.message || 'Site creation failed',
                    details: siteData
                }, { status: createSiteResponse.status });
            }

            return NextResponse.json({
                success: true,
                url: siteData.ssl_url || siteData.url,
                siteId: siteData.id,
                adminUrl: siteData.admin_url
            });
        } else {
            // Direct deployment without Git
            // First, create a site
            const createSiteResponse = await fetch('https://api.netlify.com/api/v1/sites', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${netlifyToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: siteName
                })
            });

            const siteData = await createSiteResponse.json();

            if (!createSiteResponse.ok) {
                console.error('Netlify site creation error:', siteData);
                return NextResponse.json({
                    error: siteData.message || 'Site creation failed',
                    details: siteData
                }, { status: createSiteResponse.status });
            }

            // Create a simple zip file with the HTML
            const files = {
                'index.html': html
            };

            // Deploy to the site
            const zipBuffer = await createZipBuffer(files);
            const deployResponse = await fetch(`https://api.netlify.com/api/v1/sites/${siteData.id}/deploys`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${netlifyToken}`,
                    'Content-Type': 'application/zip',
                },
                body: new Uint8Array(zipBuffer)
            });

            const deployData = await deployResponse.json();

            if (!deployResponse.ok) {
                console.error('Netlify deployment error:', deployData);
                return NextResponse.json({
                    error: deployData.message || 'Deployment failed',
                    details: deployData
                }, { status: deployResponse.status });
            }

            return NextResponse.json({
                success: true,
                url: siteData.ssl_url || siteData.url,
                siteId: siteData.id,
                deployId: deployData.id,
                adminUrl: siteData.admin_url
            });
        }

    } catch (error: any) {
        console.error('Netlify deployment error:', error);
        return NextResponse.json({
            error: error.message || 'Internal server error'
        }, { status: 500 });
    }
}

// Helper function to create a zip buffer
async function createZipBuffer(files: Record<string, string>): Promise<Buffer> {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    for (const [filename, content] of Object.entries(files)) {
        zip.file(filename, content);
    }

    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    return buffer;
}
