# 🤖 AI Features Setup

PixelTwin uses **Groq** for its AI capabilities. It is fast, free, and reliable.

## 🔑 Configuration

Your `.env` file is already configured with a Groq API key:

```env
GROQ_API_KEY=gsk_...
```

## 🛠️ How it Works

The AI logic is located in `src/app/api/ai/route.ts`.
It uses the `groq-sdk` to communicate with the `llama-3.3-70b-versatile` model.

## 🧪 Testing

You can test the AI integration using the test endpoint:
`http://localhost:3000/api/test-groq`

## 📝 Usage

In the Editor:
1.  **Select** an element.
2.  Type a prompt in the **AI Magic Edit** box (bottom left).
3.  Click **Generate**.
