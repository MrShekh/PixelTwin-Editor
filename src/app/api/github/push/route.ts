import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { Octokit } from "octokit";
import { authOptions } from "../../auth/[...nextauth]/route";

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session || !session.accessToken) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { repoName, html, message } = await request.json();

    if (!repoName || !html) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const octokit = new Octokit({
        auth: session.accessToken,
    });

    try {
        // 1. Get User Info
        const { data: user } = await octokit.rest.users.getAuthenticated();
        const owner = user.login;

        // 2. Check if repo exists, create if not
        try {
            await octokit.rest.repos.get({ owner, repo: repoName });
        } catch (e: any) {
            if (e.status === 404) {
                await octokit.rest.repos.createForAuthenticatedUser({
                    name: repoName,
                    auto_init: true, // Initialize with README so we have a main branch
                });
            } else {
                throw e;
            }
        }

        // 3. Get file SHA if it exists (for update)
        let sha;
        try {
            const { data: file } = await octokit.rest.repos.getContent({
                owner,
                repo: repoName,
                path: 'index.html',
            });
            if (!Array.isArray(file)) {
                sha = file.sha;
            }
        } catch (e: any) {
            // File doesn't exist, that's fine
        }

        // 4. Create or Update file
        await octokit.rest.repos.createOrUpdateFileContents({
            owner,
            repo: repoName,
            path: 'index.html',
            message: message || 'Update from PixelTwin',
            content: Buffer.from(html).toString('base64'),
            sha,
        });

        return NextResponse.json({ success: true, repoUrl: `https://github.com/${owner}/${repoName}` });

    } catch (error: any) {
        console.error('GitHub API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
