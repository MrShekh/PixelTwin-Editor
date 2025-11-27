# PixelTwin Studio - Website Cloner + AI Editor

PixelTwin Studio allows you to clone any website's frontend, edit it visually or with AI, and export/deploy the result.

## Features
- **Website Cloning**: Input a URL to fetch and recreate the frontend.
- **Visual Editor**: Click to edit text, swap images, and modify layout.
- **AI Magic Edit**: Use AI prompts to rewrite content or change styles (requires API key).
- **Export**: Download the project as a Zip file.
- **Project Management**: Local storage based project saving.

## Tech Stack
- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS v4
- **Language**: TypeScript
- **Backend**: Next.js API Routes
- **Parsing**: Cheerio
- **Icons**: Lucide React

## Setup

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd pixeltwin
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Variables**
   Create a `.env.local` file in the root directory:
   ```env
   # Optional: For Supabase integration (future use)
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
   
   # Optional: For AI features (if using OpenAI/Gemini)
   AI_API_KEY=your_api_key
   ```

4. **Run Locally**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment

The app is ready to be deployed on Vercel.

1. Push code to GitHub.
2. Import project in Vercel.
3. Add environment variables if needed.
4. Deploy.

## Usage Guide

1. **Clone a Site**: Enter a URL (e.g., `https://example.com`) on the home page and click "Clone".
2. **Edit**: 
   - Click on any text to edit it inline.
   - Use the sidebar tools to add/modify elements.
   - Use the "AI Magic Edit" box to describe changes.
3. **Save**: Click "Save" to store changes locally.
4. **Export**: Click "Export" to download a Zip file of your site.

## Architecture Notes

- **Cloning Logic**: `src/app/api/clone/route.ts` fetches the HTML and resolves relative URLs to absolute ones to ensure assets load. Scripts are stripped to prevent conflicts.
- **Editor**: `src/app/editor/[id]/page.tsx` uses an `iframe` to sandbox the cloned site. It injects a script into the iframe to handle click events and communicate with the parent editor via `postMessage`.
- **Project Storage**: Currently uses `localStorage` via `src/lib/project-manager.ts`. Can be easily swapped with Supabase by updating this file.

## Future Improvements
- Implement real AI integration in `src/app/api/ai/route.ts`.
- Connect Supabase for cloud storage and auth.
- Improve CSS parsing to handle complex stylesheets.
