# Furca: Branching Conversations with Grok on an Infinite Canvas

Furca (from Latin furca, meaning "fork") is a spatial AI chat interface that lets you explore ideas non-linearly. Powered by xAI's Grok (grok-4 model), it turns conversations into a branching tree on an infinite React Flow canvas—perfect for divergent thinking, research rabbit holes, brainstorming, and curiosity-driven exploration.

# Key Features

- Infinite Canvas — Pan, zoom, drag nodes freely (React Flow-powered).
- Real-Time Streaming — Grok responses stream instantly with full conversation history from root to leaf.
- Effortless Branching — Select text → right-click → "Branch with selection only" or "with full context". New nodes connect automatically.
- Clean Node Design — Input bar, Markdown-rendered assistant bubble, delete button (non-root nodes), vertical handles for tree flow.

# Tech Stack

Frontend: TypeScript, Vite, React, React Flow (@xyflow/react), ReactMarkdown.
AI Backend: xAI Grok API (grok-4 via OpenAI-compatible endpoint).
Deployment: AWS Amplify (static hosting + serverless functions + secrets management).
No heavy dependencies — Lightweight and fast.

# Contributing
Contributions welcome! Ideas:

- Semantic zooming 
- Save chats

Open an issue or PR.