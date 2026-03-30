# PixelTwin Studio 🎨

Clone any website and edit it with AI-powered precision.

## Features

- 🌐 **Website Cloning**: Clone any website by URL or upload HTML files
- ✏️ **Visual Editing**: Click to select and edit any element
- 🤖 **AI-Powered Editing**: Use AI to modify specific elements or entire pages
- 📸 **Image Replacement**: Click images to replace them instantly
- 🎯 **Element-Specific AI**: Select any element and apply AI changes to just that part
- 🔗 **GitHub Integration**: Push your edited projects directly to GitHub
- 📦 **Export Options**: Download as ZIP or push to version control
- 💾 **Project Management**: Save and manage multiple projects locally

## New: GitHub Integration 🚀

You can now connect your GitHub account and push your edited projects directly to GitHub repositories!

### How to Use:
1. Click "Connect GitHub" in the editor sidebar
2. Authorize PixelTwin with your GitHub account
3. Enter a repository name
4. Click "Push to GitHub" - the app will:
   - Create the repository if it doesn't exist
   - Push your edited HTML as `index.html`
   - Open the repository in a new tab

See [GITHUB_SETUP.md](./GITHUB_SETUP.md) for detailed setup instructions.

## Quick Start

### 1. Clone the repository
```bash
git clone https://github.com/yourusername/pixeltwin.git
cd pixeltwin
```

### 2. Install dependencies
```bash
npm install
```

### 3. Set up environment variables
Copy `env.example` to `.env` and fill in your credentials:
```bash
cp env.example .env
```

Required environment variables:
- `GROQ_API_KEY`: Get from [Groq Console](https://console.groq.com)
- `GITHUB_ID` & `GITHUB_SECRET`: See [GITHUB_SETUP.md](./GITHUB_SETUP.md)
- `NEXTAUTH_URL`: Your app URL (http://localhost:3000 for development)
- `NEXTAUTH_SECRET`: Generate with `openssl rand -base64 32`

### 4. Run the development server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

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
