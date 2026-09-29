# Sport Lending Equipment Website (DSA Project)

Stack: React (Vite) + Node.js/Express (JavaScript) + Supabase (PostgreSQL, free)

## Folder structure
```
sport-lending/
├── supabase.sql
├── .gitignore
├── README.md
├── backend/   package.json, .env.example, server.js, dsa.js
└── frontend/  package.json, vite.config.js, index.html, src/{main.jsx, App.jsx, api.js, styles.css}
```

## DSA used
| # | Data Structure | Where |
|---|---|---|
| 1 | Hash Map (chaining) | Equipment stored by id, O(1) lookup |
| 2 | Queue (FIFO) | Waitlist when equipment is out of stock |
| 3 | Stack (LIFO) | Undo add / update / delete |
| 4 | Singly Linked List | Loan history, newest first |

| # | Algorithm | Where |
|---|---|---|
| 1 | Merge Sort | Sort equipment (default) |
| 2 | Quick Sort | Sort equipment (selectable) |
| 3 | Binary Search | Exact-name lookup on the sorted list |
| 4 | Linear Search | Keyword and category filtering, duplicate check |

## Features
Add, update, delete, display, search, sort, undo, borrow, return, waitlist, overdue flag,
data validation (frontend and backend), Supabase persistent storage.

## Setup
1. supabase.com > New project > SQL Editor > paste `supabase.sql` > Run.
2. Project Settings > API: copy the Project URL and the `service_role` key.
3. `cd backend && cp .env.example .env` then fill in SUPABASE_URL and SUPABASE_KEY.
4. Run (two terminals):
   - `cd backend && npm install && npm start`
   - `cd frontend && npm install && npm run dev` then open http://localhost:5173

## Deploy on Render (free, one service)
1. Push the whole `sport-lending` folder to GitHub.
2. Render > New > Web Service > choose the repo.
3. Build Command: `cd frontend && npm install && npm run build && cd ../backend && npm install`
4. Start Command: `node backend/server.js`
5. Environment: add SUPABASE_URL and SUPABASE_KEY.
