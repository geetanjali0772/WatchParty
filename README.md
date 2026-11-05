# WatchParty 🎬🍿
> Watch YouTube Together in Real Time with Sub-Second Synchronization & Role-Based Control.

---

## 1. Project Overview

**WatchParty** is a full-stack, enterprise-grade real-time web application built with the MERN stack (MongoDB, Express.js, React, Node.js) and Socket.IO. It empowers groups of friends, communities, and remote teams to create virtual watch rooms and stream YouTube videos in perfect synchrony across all connected devices.

Whenever a room controller plays, pauses, seeks, or changes a video, every connected participant's player reacts synchronously. A role-based access control (RBAC) engine ensures organized playback while giving participants an approval-driven request interface.

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
- **Routing:** React Router DOM (v6)
- **API Client:** Axios (with automatic credentials and session refresh interceptors)
- **Real-Time:** Socket.IO Client (v4)
- **Icons:** Lucide React
- **Video API:** YouTube IFrame Player API

### Backend
- **Runtime:** Node.js (v20+)
- **Framework:** Express.js (v4)
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
│                                │ <────────────────────────────── │                                │
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
                                                                   │       MongoDB Database         │
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
├── package.json                   # Root workspace scripts
├── README.md                      # Comprehensive project documentation
├── server/                        # Backend Application
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
│   │   └── watchparty.test.js     # Full 54-scenario automated test suite
│   ├── .env.example               # Backend environment template
│   └── package.json               # Backend dependencies and scripts
│
└── client/                        # Frontend Application
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
    │   │   ├── Home.jsx               # Hero landing page matching design mockup
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
    ├── .env.example                   # Frontend environment template
    └── package.json                   # Frontend dependencies and scripts
```

---

## 6. Installation & Setup Instructions

### Prerequisites
- **Node.js**: v18.0.0 or later (v20+ recommended)
- **npm**: v9.0.0 or later
- **MongoDB**: Local MongoDB instance (or Docker container running `mongodb://localhost:27017/watchparty`)

### Install Dependencies
```bash
# Install backend dependencies
cd server
npm install

# Install frontend dependencies
cd ../client
npm install
```

---

## 7. Environment Variable Configuration

### Backend (`server/.env`)
Create a `.env` file in the `server/` directory:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/watchparty
CLIENT_URL=http://localhost:5173
JWT_SECRET=super-secret-jwt-key-min-32-chars-long-12345
NODE_ENV=development
```

### Frontend (`client/.env`)
Create a `.env` file in the `client/` directory:
```env
VITE_API_URL=/api
VITE_SOCKET_URL=http://localhost:5000
```

---

## 8. How to Run Frontend and Backend Locally

### Option 1: Running Concurrently from Root
From the root `WatchParty` directory:
```bash
npm run dev
```

### Option 2: Running in Separate Terminals

1. **Start Backend Server:**
   ```bash
   cd server
   npm run dev
   ```
   *Backend starts on `http://localhost:5000` with active MongoDB connection.*

2. **Start Frontend Client:**
   ```bash
   cd client
   npm run dev
   ```
   *Frontend starts on `http://localhost:5173`.*

3. Open your browser and navigate to `http://localhost:5173`.

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

A comprehensive end-to-end integration and security test suite is located in `server/test/watchparty.test.js`. It runs natively using Node.js's test runner and validates **all 54 test scenarios**:

```bash
cd server
npm test
```

### Test Suite Summary:
- **Total Tests:** 54
- **Passed:** 54 (100%)
- **Failed:** 0
- **Suites:** Authentication, RBAC, Multi-Tab Online Tracking, Playback Synchronization, Drift Correction, Request Approval Workflow, Text Chat & HTML Sanitization, Rate Limiting, Emoji Reactions, Host Transfer ACID Transactions, Invariant Validation, Room Title Rename, Socket Reconnection State Recovery, and Ban Enforcement.

---

## 12. Production Deployment

### 1. Database (MongoDB Atlas)
1. Set up a MongoDB Atlas Replica Set cluster.
2. Obtain connection URI: `mongodb+srv://<user>:<password>@cluster.mongodb.net/watchparty?retryWrites=true&w=majority`.

### 2. Backend (Render / Railway / Fly.io)
- Root Directory: `server`
- Build Command: `npm install`
- Start Command: `npm start`
- Environment Variables:
  - `PORT`: `5000`
  - `MONGODB_URI`: `<Atlas URI>`
  - `CLIENT_URL`: `https://your-watchparty-domain.com`
  - `JWT_SECRET`: `<64-byte secure key>`
  - `NODE_ENV`: `production`

### 3. Frontend (Vercel / Netlify / Render)
- Root Directory: `client`
- Build Command: `npm run build`
- Output Directory: `dist`
- Environment Variables:
  - `VITE_API_URL`: `/api`
  - `VITE_SOCKET_URL`: `https://your-watchparty-api.com`
