# WatchParty 🎬🍿
> Watch YouTube Together in Real Time with Sub-Second Synchronization & Role-Based Control.

[![Live Demo](https://img.shields.io/badge/Live_Demo-Vercel-000000?style=for-the-badge&logo=vercel)](https://watch-party-omega-six.vercel.app/)
[![Repository](https://img.shields.io/badge/GitHub-geetanjali0772%2FWatchParty-10b981?style=for-the-badge&logo=github)](https://github.com/geetanjali0772/WatchParty.git)
[![React](https://img.shields.io/badge/React-18.3-61dafb?style=for-the-badge&logo=react)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=for-the-badge&logo=node.js)](https://nodejs.org/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8-010101?style=for-the-badge&logo=socket.io)](https://socket.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38bdf8?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47a248?style=for-the-badge&logo=mongodb)](https://www.mongodb.com/)

---

## 1. Project Overview

**WatchParty** is a full-stack, enterprise-grade real-time web application built with the MERN stack (MongoDB, Express.js, React, Node.js) and Socket.IO. It empowers groups of friends, communities, and remote teams to create virtual watch rooms and stream YouTube videos in perfect synchrony across all connected devices.

Whenever a room controller plays, pauses, seeks, or changes a video, every connected participant's player reacts synchronously. A role-based access control (RBAC) engine ensures organized playback while giving participants an approval-driven request interface.

- **Live Demo / Deployed Application:** [https://watch-party-omega-six.vercel.app/](https://watch-party-omega-six.vercel.app/)
- **GitHub Repository:** [https://github.com/geetanjali0772/WatchParty.git](https://github.com/geetanjali0772/WatchParty.git)

---

## 2. Key Features

- **Instant Room Creation & Joining:**
  - One-click room creation with unique 6-character room codes.
  - Direct shareable invitation links (`/join/:roomId` and `/room/:roomId`).
  - Dedicated "Copy Code" and "Copy Link" buttons with instant feedback.
  - Creator is automatically assigned the authoritative **Host** role.
- **Persistent Rooms & Sessions:**
  - Full MongoDB persistence for rooms, playback state, timestamps, and participant rosters.
  - Rejoining rooms restores synchronized state immediately without duplicate participant records.
- **JWT-Based Authentication & Verified Identity:**
  - Secure token creation (`POST /api/auth/session`) supporting seamless guest participation.
  - Cryptographically signed HttpOnly cookie storage (`wp_token`) with Bearer token header fallback.
  - Cross-domain cookie support (`sameSite: 'none'`, `secure: true`) for separated frontend and backend deployments.
  - Socket.IO connection handshake identity verification via `socketAuthMiddleware`.
  - Zero trust in client-supplied role or permissions; user identity derived strictly from verified JWT claims.
- **Real-Time Video Synchronization:**
  - YouTube IFrame Player API integration with strict drift correction (< 1s tolerance).
  - Instant synchronization for **Play**, **Pause**, **Seek**, and **Video Changes**.
  - Programmatic loop guards preventing infinite sync broadcast ping-pong.
  - Authoritative snap-back protection: unauthorized participant attempts to play/pause locally snap back to server state.
- **Custom YouTube Seek Bar with Pointer Capture:**
  - Smooth HTML5 range slider with native pointer capture (`setPointerCapture`).
  - Isolated dragging state prevents playback jitter while scrubbing.
  - Clamped non-negative finite timestamps validated strictly on the backend.
- **Role-Based Access Control (RBAC):**
  - **Host:** Full administrative and playback authority (Play, Pause, Seek, Video Change, Rename Room, Promote, Demote, Kick, Transfer Host, Review Requests).
  - **Moderator:** Playback authority (Play, Pause, Seek, Video Change, Review Requests).
  - **Participant:** Read-only playback observation, chat, emoji reactions, and playback request submission.
  - **Strict Server-Side Enforcement:** Every sensitive Socket.IO event is verified on the backend before execution.
- **Transfer Host Ownership:**
  - Host can transfer complete room ownership to any online participant in the room.
  - Managed via MongoDB ACID transactions with automatic rollback compensation.
  - Invariant: Exactly 1 active Host per room at all times.
  - Former host is demoted to Participant; new host is issued updated private host credentials.
- **Real-Time Text Chat:**
  - In-room chat interface with sender username, role badges, and timestamps.
  - HTML sanitization against Cross-Site Scripting (XSS).
  - Sliding-window rate limiting to prevent spam.
  - Message persistence in MongoDB with authenticated REST endpoint retrieval (`GET /api/rooms/:roomId/messages`).
- **Emoji Reactions & Floating Animation:**
  - Expressive reactions (`❤️`, `🔥`, `😂`, `👏`, `🎉`, `😮`) floating smoothly over the synchronized video container.
  - Per-user rate limiting and room-isolated broadcasting.
- **Participant Request & Approval System:**
  - Participants can submit structured requests to Play, Pause, Seek to a timestamp, or change the video.
  - Real-time confirmation using Socket.IO acknowledgement callbacks.
  - Hosts and Moderators receive real-time request alerts and can Approve or Reject them with a single click.
  - Approved requests execute immediately on the room's synchronized player.
- **Room Title Rename Workflow:**
  - Host can rename room in real time with persistence in MongoDB.
  - Broadcasts `room_updated` event to all connected sockets in the room.
- **Automatic Socket Reconnection & State Recovery:**
  - Reconnecting sockets automatically re-authenticate and re-emit `join_room`.
  - Receives fresh authoritative `sync_state` and reloads chat history without duplicates.
- **Modern Emerald Green SaaS UI/UX:**
  - Fresh, modern light emerald green design system matching reference mockups.
  - Lucide React iconography, custom video controls, live participant counter, and animated toasts.
  - Responsive 3-column layout with theater mode support.

---

## 3. Tech Stack

### Frontend
- **Framework:** React.js (Vite)
- **Language:** JavaScript (ES Modules, strictly JS — no TypeScript)
- **Styling:** Tailwind CSS (Modern Emerald Green & Mint theme)
- **Routing:** React Router DOM (v6) with Vercel SPA rewrites
- **API Client:** Axios (with automatic credentials and session refresh interceptors)
- **Real-Time:** Socket.IO Client (v4)
- **Icons:** Lucide React
- **Video API:** YouTube IFrame Player API

### Backend
- **Runtime:** Node.js (v20+)
- **Framework:** Express.js (v4) with `trust proxy` enabled for cloud platforms (Render, Heroku)
- **Language:** JavaScript (ES Modules)
- **Database:** MongoDB & Mongoose (v8) with Replica Set transaction support
- **Real-Time Engine:** Socket.IO (v4)
- **Security & Utilities:** JWT (`jsonwebtoken`), Cookie-Parser, CORS, Dotenv, Crypto

---

## 4. Architecture Overview

WatchParty utilizes a decoupled client-server architecture:

```
┌────────────────────────────────┐         REST API (HTTP/JSON)    ┌────────────────────────────────┐
│         React Client           │ ──────────────────────────────> │       Express.js Server        │
│   (Deployed on Vercel)         │ <────────────────────────────── │      (Deployed on Render)      │
│   • YouTube IFrame API         │                                 │   • Room Controller            │
│   • Custom Controls & Scrubber │     Bidirectional WebSockets    │   • Auth Middleware (JWT/Cookie)│
│   • Room Context & State Store │ <═════════════════════════════> │   • Permission Service (RBAC)  │
│   • Request Approval UI        │         (Socket.IO)             │   • Socket.IO Event Handlers   │
│   • Chat & Reaction System     │                                 │   • Anti-Drift Periodic Sync   │
└────────────────────────────────┘                                 └────────────────┬───────────────┘
                                                                                    │
                                                                           Mongoose │ Queries & Transactions
                                                                                    ▼
                                                                   ┌────────────────────────────────┐
                                                                   │    MongoDB Database (Atlas)    │
                                                                   │   • rooms collection           │
                                                                   │   • participants collection    │
                                                                   │   • messages collection        │
                                                                   └────────────────────────────────┘
```

1. **REST API** handles room creation, metadata retrieval, guest authentication, room joining, chat history, and room title updates.
2. **Socket.IO** handles low-latency room channels, playback state replication, participant management, host transfer, reactions, chat, and request workflows.
3. **Mongoose Models** persist room states (including video ID, playback state, timestamps, banned users), participants with composite indexes (`{ roomId: 1, userId: 1 }`), and chat messages.

---

## 5. Folder Structure

```
WatchParty/
├── README.md                      # Comprehensive project documentation
├── .gitignore                     # Git ignore rules
│
├── server/                        # Backend Application (Deploy to Render)
│   ├── src/
│   │   ├── config/
│   │   │   └── db.js              # Mongoose MongoDB connection
│   │   ├── models/
│   │   │   ├── Room.js            # Room Mongoose schema & calculation methods
│   │   │   ├── Participant.js     # Participant Mongoose schema with composite index
│   │   │   └── Message.js         # Chat message Mongoose schema
│   │   ├── controllers/
│   │   │   ├── authController.js  # Guest session & token issuance
│   │   │   └── roomController.js  # REST controllers (create, get, join, rename, messages)
│   │   ├── routes/
│   │   │   ├── authRoutes.js      # Session authentication route
│   │   │   └── roomRoutes.js      # REST API route declarations
│   │   ├── middleware/
│   │   │   ├── authMiddleware.js  # JWT cookie & header verification middleware
│   │   │   └── errorHandler.js    # Global error handling middleware
│   │   ├── socket/
│   │   │   ├── index.js           # Socket.IO orchestrator & drift synchronizer
│   │   │   ├── roomHandler.js     # join_room, leave_room, update_room_title, disconnect
│   │   │   ├── playbackHandler.js # play, pause, seek, change_video
│   │   │   ├── roleHandler.js     # assign_role, transfer_host, remove_participant
│   │   │   ├── requestHandler.js  # playback_request, approve_request, reject_request
│   │   │   ├── chatHandler.js     # send_message, sanitization & rate limiting
│   │   │   └── reactionHandler.js # send_reaction & rate limiting
│   │   ├── services/
│   │   │   ├── roomService.js     # Room lifecycle, host transfer transaction & state logic
│   │   │   └── permissionService.js # RBAC authorization checks
│   │   ├── utils/
│   │   │   ├── jwt.js             # JWT signing and validation
│   │   │   ├── generateRoomCode.js  # 6-character room code generator
│   │   │   └── extractYoutubeId.js  # Multi-format YouTube URL/ID parser
│   │   ├── app.js                 # Express application & CORS configuration
│   │   └── server.js              # HTTP server & Socket.IO initialization
│   ├── test/
│   │   └── watchparty.test.js     # Full automated test suite
│   ├── .env                       # Backend local environment variables
│   ├── .env.example               # Backend environment template
│   └── package.json               # Backend dependencies and scripts
│
└── client/                        # Frontend Application (Deploy to Vercel)
    ├── src/
    │   ├── components/
    │   │   ├── Navbar.jsx             # Top branding, about modal, display name
    │   │   ├── VideoPlayer.jsx        # YouTube IFrame wrapper & live sync indicator
    │   │   ├── PlaybackControls.jsx   # Custom pointer-capture seek bar, play/pause, skip, volume
    │   │   ├── VideoInput.jsx         # URL parser & change/request video input
    │   │   ├── ParticipantsList.jsx   # Online participants sidebar with Host transfer
    │   │   ├── ParticipantCard.jsx    # Avatar, username, role badge, 3-dots actions
    │   │   ├── RoleBadge.jsx          # Styled badges (Host, Moderator, Participant)
    │   │   ├── RequestPanel.jsx       # Participant request submission & Host approval queue
    │   │   ├── ChatPanel.jsx          # Real-time text chat & quick emoji bar
    │   │   └── EmojiOverlay.jsx       # Floating emoji reaction animations
    │   ├── pages/
    │   │   ├── Home.jsx               # Hero landing page
    │   │   ├── CreateRoom.jsx         # Room creation card
    │   │   ├── JoinRoom.jsx           # Room join card with direct link support
    │   │   └── WatchRoom.jsx          # Main 3-column video party dashboard
    │   ├── context/
    │   │   └── RoomContext.jsx        # Central real-time state, socket reconnect & provider
    │   ├── hooks/
    │   │   ├── useRoom.js             # RoomContext consumer hook
    │   │   ├── useSocket.js           # Socket connectivity hook
    │   │   └── useYoutubePlayer.js    # YouTube IFrame API controller hook with loop guards
    │   ├── services/
    │   │   ├── api.js                 # Axios API service
    │   │   └── socket.js              # Socket.IO client singleton
    │   ├── utils/
    │   │   └── youtube.js             # Time formatting and YouTube URL utilities
    │   ├── App.jsx                    # Route switch & layout
    │   ├── main.jsx                   # React root entrypoint
    │   └── index.css                  # Tailwind styles and custom scrollbars
    ├── index.html                     # HTML root template with Inter font
    ├── tailwind.config.js             # Emerald green design system tokens
    ├── vite.config.js                 # Vite bundler & API proxy configuration
    ├── vercel.json                    # Vercel SPA routing rewrite configuration
    ├── .env                           # Frontend local environment variables
    ├── .env.example                   # Frontend environment template
    └── package.json                   # Frontend dependencies and scripts
```

---

## 6. Installation & Setup Instructions

### Clone Repository
```bash
git clone https://github.com/geetanjali0772/WatchParty.git
cd WatchParty
```

### Prerequisites
- **Node.js**: v18.0.0 or later (v20+ recommended)
- **npm**: v9.0.0 or later
- **MongoDB**: MongoDB Atlas URI or local MongoDB (`mongodb://localhost:27017/watchparty`)

### Install Dependencies

Install the backend and frontend dependencies directly in their respective folders:

```bash
# 1. Install backend dependencies
cd server
npm install

# 2. Install frontend dependencies
cd ../client
npm install
```

---

## 7. Environment Variable Configuration

### Backend (`server/.env`)
Create a `.env` file in the `server/` directory:
```env
PORT=5000
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/watchparty?retryWrites=true&w=majority
CLIENT_URL=http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174
NODE_ENV=development
JWT_SECRET=your_jwt_secret_min_32_characters_long_placeholder
JWT_EXPIRES_IN=7d
```

### Frontend (`client/.env`)
Create a `.env` file in the `client/` directory:
```env
# For local development (Vite proxies requests to backend):
VITE_API_URL=/api
VITE_SOCKET_URL=http://localhost:5000
```

---

## 8. How to Run Locally

Run the frontend and backend in separate terminal windows:

### Terminal 1: Frontend Client
```bash
cd client
npm run dev
```
*Frontend runs on `http://localhost:5173` (or `5174` if 5173 is in use).*

Open your browser and navigate to `http://localhost:5173`.

### Terminal 2: Backend Server
```bash
cd server
npm run dev
```

---

## 9. Socket.IO Event Reference

### Client-to-Server Events

| Event | Payload | Description | Role Required |
|---|---|---|---|
| `join_room` | `{ roomId, hostToken }` | Connects socket to room, validates session, returns authoritative `sync_state`. | Any |
| `leave_room` | None | Disconnects socket from room, updates online count. | Any |
| `update_room_title`| `{ roomName }` | Updates room title in MongoDB and broadcasts `room_updated`. | Host only |
| `play` | `{ currentTime }` | Starts synchronized playback at timestamp. | Host, Moderator |
| `pause` | `{ currentTime }` | Pauses synchronized playback at timestamp. | Host, Moderator |
| `seek` | `{ currentTime }` | Seeks all players to timestamp (validated finite non-negative number). | Host, Moderator |
| `change_video`| `{ url }` | Validates YouTube link and updates video for all users. | Host, Moderator |
| `assign_role` | `{ targetUserId, newRole }` | Promotes/demotes participant (`Moderator` or `Participant`). | Host only |
| `transfer_host` | `{ targetUserId }` | Transfers Host ownership atomically via MongoDB transaction. | Host only |
| `remove_participant` | `{ targetUserId }` | Bans and kicks user from room, revokes access. | Host only |
| `playback_request` | `{ type, payload }` | Submits request to play, pause, seek, or change video with ack callback. | Participant |
| `approve_request` | `{ requestId }` | Approves request and executes action automatically. | Host, Moderator |
| `reject_request` | `{ requestId }` | Declines request and notifies room. | Host, Moderator |
| `send_message` | `{ content }` | Sends sanitized chat message. | Member |
| `send_reaction` | `{ emoji }` | Broadcasts floating emoji reaction. | Member |

### Server-to-Client Events

| Event | Payload | Description |
|---|---|---|
| `sync_state` | `{ room, myRole, participants, pendingRequests, onlineCount }` | Sent on join with full initial room state. |
| `user_joined` | `{ user, participants, onlineCount }` | Broadcast when a new participant enters. |
| `user_left` | `{ userId, username, participants, onlineCount }` | Broadcast when a user disconnects or leaves. |
| `room_updated` | `{ roomId, roomName }` | Broadcast when the Host renames the room. |
| `playback_updated` | `{ playbackState, currentTime, lastUpdated, updatedBy }` | Broadcast on play, pause, seek. |
| `seek_applied` | `{ currentTime, playbackState }` | Dedicated seek execution event for instant synchronization. |
| `video_changed` | `{ currentVideoId, currentTime, playbackState, updatedBy }` | Broadcast when a new YouTube video is loaded. |
| `role_assigned` | `{ targetUserId, targetUsername, newRole, participants }` | Broadcast when a user's role is updated. |
| `host_transferred` | `{ roomId, newHostId, newHostUsername, previousHostId, participants }` | Broadcast when Host ownership is transferred. |
| `host_promoted` | `{ hostToken }` | Private socket message sent ONLY to the new Host containing the host token. |
| `participant_removed`| `{ targetUserId, targetUsername, participants, isTarget }` | Broadcast when a user is kicked. |
| `request_received` | `{ request, pendingRequests }` | Broadcast when a participant submits a request. |
| `request_approved` | `{ requestId, request, pendingRequests, approvedBy }` | Broadcast when request is approved. |
| `request_rejected` | `{ requestId, pendingRequests, rejectedBy }` | Broadcast when request is declined. |
| `new_message` | `{ message }` | Broadcast when a new chat message is persisted. |
| `new_reaction` | `{ id, emoji, username, userId }` | Broadcast when an emoji reaction is triggered. |
| `periodic_sync` | `{ roomId, currentTime, playbackState, currentVideoId }` | Periodic anti-drift beacon from server. |
| `error` | `{ message, code }` | Sent to client when an unauthorized or invalid action is attempted. |

---

## 10. Role-Based Access Control (RBAC)

The application enforces a 3-tier permission hierarchy:

```
                  ┌────────────────────────┐
                  │       👑 Host          │
                  │  (Full Room Control)   │
                  └───────────┬────────────┘
                              │ Promotes / Demotes / Kicks / Transfers Host
                              ▼
                  ┌────────────────────────┐
                  │      🛡️ Moderator       │
                  │   (Playback Control)   │
                  └───────────┬────────────┘
                              │ Approves / Rejects Requests
                              ▼
                  ┌────────────────────────┐
                  │     👤 Participant     │
                  │ (Synced View & Request)│
                  └────────────────────────┘
```

### Permission Matrix

| Capability | Host | Moderator | Participant |
|---|:---:|:---:|:---:|
| Watch synchronized video | ✅ | ✅ | ✅ |
| View participant roster & roles | ✅ | ✅ | ✅ |
| Play / Pause video | ✅ | ✅ | ❌ *(Request only)* |
| Seek video timeline | ✅ | ✅ | ❌ *(Request only)* |
| Change YouTube video | ✅ | ✅ | ❌ *(Request only)* |
| Rename room title | ✅ | ❌ | ❌ |
| Submit playback requests | ❌ | ❌ | ✅ |
| Approve / reject requests | ✅ | ✅ | ❌ |
| Promote to Moderator | ✅ | ❌ | ❌ |
| Demote to Participant | ✅ | ❌ | ❌ |
| Transfer Host ownership | ✅ | ❌ | ❌ |
| Remove (kick/ban) participant | ✅ | ❌ | ❌ |
| Send text chat messages | ✅ | ✅ | ✅ |
| Send emoji reactions | ✅ | ✅ | ✅ |

---

## 11. Testing & Verification

A comprehensive integration and security test suite is located in `server/test/watchparty.test.js`. It runs natively using Node.js's test runner:

```bash
cd server
npm test
```

### Covered Test Categories:
- **Authentication:** Token creation, cookie issuance, expiration verification, anti-CSRF protection.
- **RBAC:** Host, Moderator, and Participant permission boundaries; rejection of unauthorized playback commands.
- **Multi-Tab Tracking:** Online presence tracking across multiple tabs without premature disconnects.
- **Playback Synchronization:** Real-time play, pause, seek, and video change synchronization.
- **Host Transfer:** Atomic single-host invariance verified via MongoDB ACID transactions.
- **Request Approval System:** Playback request submission, Host/Moderator approval, and rejection.
- **Text Chat & Reactions:** In-room sanitization, rate limiting, and persistence.
- **Banning & Removal:** Immediate socket disconnect and re-join prevention.

---

## 12. Deployment Guide

### Deploying Backend to Render

1. Log in to [Render](https://render.com) and click **New + > Web Service**.
2. Connect your repository: `https://github.com/geetanjali0772/WatchParty.git`.
3. Configure the service settings:
   - **Name:** `watchparty-server` (or your choice)
   - **Root Directory:** `server`
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. Add the following **Environment Variables** in Render:
   - `NODE_ENV`: `production`
   - `PORT`: `5000` *(Render sets `$PORT` dynamically, fallback to 5000)*
   - `MONGODB_URI`: `mongodb+srv://<username>:<password>@cluster0.mongodb.net/watchparty?retryWrites=true&w=majority`
   - `JWT_SECRET`: `<minimum-32-characters-secure-secret-key>`
   - `CLIENT_URL`: `https://your-watchparty-app.vercel.app` *(or `https://*.vercel.app`)*
5. Click **Create Web Service**. Note your Render URL (e.g. `https://watchparty-server.onrender.com`).

---

### Deploying Frontend to Vercel

1. Log in to [Vercel](https://vercel.com) and click **Add New > Project**.
2. Import the `WatchParty` repository.
3. Configure the project settings:
   - **Framework Preset:** `Vite`
   - **Root Directory:** Click Edit and select `client`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Add the following **Environment Variables** in Vercel:
   - `VITE_API_URL`: `https://watchparty-server.onrender.com/api`
   - `VITE_SOCKET_URL`: `https://watchparty-server.onrender.com`
5. Click **Deploy**.
6. Once deployed, copy your Vercel deployment URL and ensure it is included in your backend's `CLIENT_URL` environment variable on Render.
   - **Live Production URL:** [https://watch-party-omega-six.vercel.app/](https://watch-party-omega-six.vercel.app/)

---

## 13. License

This project is licensed under the ISC License.
