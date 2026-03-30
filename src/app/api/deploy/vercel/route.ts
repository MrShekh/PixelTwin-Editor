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

        const vercelToken = process.env.VERCEL_TOKEN;

        if (!vercelToken) {
            return NextResponse.json({
                error: 'Vercel token not configured. Please add VERCEL_TOKEN to your environment variables.'
            }, { status: 500 });
        }

        // Create deployment using Vercel API
        const deploymentPayload = {
            name: projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
            files: [
                {
                    file: 'index.html',
                    data: html
                },
                {
                    file: 'vercel.json',
                    data: JSON.stringify({
                        version: 2,
                        builds: [
                            {
                                src: 'index.html',
                                use: '@vercel/static'
                            }
                        ]
                    })
                }
            ],
            projectSettings: {
                framework: null
            }
        };

        // If GitHub repo URL is provided, use it for deployment
        if (repoUrl) {
            const response = await fetch('https://api.vercel.com/v13/deployments', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${vercelToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
                    gitSource: {
                        type: 'github',
                        repo: repoUrl.replace('https://github.com/', ''),
                        ref: 'main'
                    }
                })
            });

            const data = await response.json();

            if (!response.ok) {
                console.error('Vercel deployment error:', data);
                return NextResponse.json({
                    error: data.error?.message || 'Deployment failed',
                    details: data
                }, { status: response.status });
            }

            return NextResponse.json({
                success: true,
                url: `https://${data.url}`,
                deploymentId: data.id,
                inspectorUrl: data.inspectorUrl
            });
        } else {
            // Direct file deployment
            const response = await fetch('https://api.vercel.com/v13/deployments', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${vercelToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(deploymentPayload)
            });

            const data = await response.json();

            if (!response.ok) {
                console.error('Vercel deployment error:', data);
                return NextResponse.json({
                    error: data.error?.message || 'Deployment failed',
                    details: data
                }, { status: response.status });
            }

            return NextResponse.json({
                success: true,
                url: `https://${data.url}`,
                deploymentId: data.id,
                inspectorUrl: data.inspectorUrl
            });
        }

    } catch (error: any) {
        console.error('Vercel deployment error:', error);
        return NextResponse.json({
            error: error.message || 'Internal server error'
        }, { status: 500 });
    }
}
