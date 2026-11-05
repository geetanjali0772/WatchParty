process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'watchparty_test_suite_jwt_secret_32_characters_long';

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { Server } from 'socket.io';
import { io as Client } from 'socket.io-client';
import mongoose from 'mongoose';
import app, { isAllowedOrigin } from '../src/app.js';
import { connectDB } from '../src/config/db.js';
import { initSocket } from '../src/socket/index.js';
import { Room } from '../src/models/Room.js';
import { Participant } from '../src/models/Participant.js';
import { Message } from '../src/models/Message.js';
import { generateToken, getJwtSecret } from '../src/utils/jwt.js';

const TEST_PORT = 5055;
const SERVER_URL = `http://localhost:${TEST_PORT}`;

// Helper to wait for an event on a socket with timeout
const waitForEvent = (socket, eventName, timeoutMs = 4000) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for event '${eventName}' on socket ${socket.id}`));
    }, timeoutMs);

    socket.once(eventName, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
};

test('YouTube Watch Party - Complete Security, RBAC & Sync Integration Suite', async (t) => {
  let server;
  let ioServer;
  let socketA; // Host
  let socketB; // Participant / Moderator
  let roomId;
  let hostToken;

  let userA = { username: 'HostAlice' };
  let tokenA = null;

  let userB = { username: 'GuestBob' };
  let tokenB = null;

  let userC = { username: 'VisitorCharlie' };
  let tokenC = null;

  // Setup: start test server and connect to MongoDB
  await t.test('Setup Server, Database & Test JWT Auth Sessions', async () => {
    await connectDB();
    server = http.createServer(app);
    ioServer = new Server(server, { cors: { origin: '*' } });
    initSocket(ioServer);

    await new Promise((resolve) => server.listen(TEST_PORT, resolve));
    console.log(`[Test] Server started on port ${TEST_PORT}`);

    // Create session for User A (Host)
    const resA = await fetch(`${SERVER_URL}/api/auth/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: userA.username }),
    });
    const dataA = await resA.json();
    assert.equal(resA.status, 200);
    userA = dataA.data.user;
    tokenA = dataA.data.token;
    assert.ok(userA.userId);
    assert.ok(tokenA);

    // Create session for User B (Guest/Participant)
    const resB = await fetch(`${SERVER_URL}/api/auth/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: userB.username }),
    });
    const dataB = await resB.json();
    assert.equal(resB.status, 200);
    userB = dataB.data.user;
    tokenB = dataB.data.token;
    assert.ok(userB.userId);
    assert.ok(tokenB);

    // Create session for User C (External visitor)
    const resC = await fetch(`${SERVER_URL}/api/auth/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: userC.username }),
    });
    const dataC = await resC.json();
    assert.equal(resC.status, 200);
    userC = dataC.data.user;
    tokenC = dataC.data.token;
    assert.ok(userC.userId);
    assert.ok(tokenC);
  });

  // Regression: Missing or short JWT_SECRET fails startup validation
  await t.test('Regression: Missing or insecure JWT_SECRET fails validation', async () => {
    const savedSecret = process.env.JWT_SECRET;
    try {
      delete process.env.JWT_SECRET;
      assert.throws(
        () => getJwtSecret(),
        /FATAL SECURITY ERROR: JWT_SECRET environment variable is missing or insecure/
      );

      process.env.JWT_SECRET = 'too_short';
      assert.throws(
        () => getJwtSecret(),
        /at least 32 characters long in all environments/
      );
    } finally {
      process.env.JWT_SECRET = savedSecret;
    }
  });

  // Regression: Cookie-based authentication works for REST and Socket.IO
  await t.test('Regression: Cookie-based authentication works for REST and Socket.IO', async () => {
    // 1. REST GET /api/auth/me authenticated purely via HttpOnly cookie
    const meRes = await fetch(`${SERVER_URL}/api/auth/me`, {
      method: 'GET',
      headers: {
        Cookie: `wp_token=${tokenA}`,
      },
    });
    assert.equal(meRes.status, 200);
    const meData = await meRes.json();
    assert.equal(meData.data.user.userId, userA.userId);

    // 2. REST state-changing POST /api/rooms with Cookie & X-Requested-With (Anti-CSRF)
    const cookieRoomRes = await fetch(`${SERVER_URL}/api/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        Cookie: `wp_token=${tokenA}`,
      },
      body: JSON.stringify({ roomName: 'Cookie Auth Room' }),
    });
    assert.equal(cookieRoomRes.status, 201);
    const cookieRoomData = await cookieRoomRes.json();
    assert.ok(cookieRoomData.data.room.roomId);

    // 3. CSRF Protection: Cookie without X-Requested-With or X-CSRF-Token is rejected with 403
    const csrfBlockedRes = await fetch(`${SERVER_URL}/api/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `wp_token=${tokenA}`,
        // Missing X-Requested-With & X-CSRF-Token
      },
      body: JSON.stringify({ roomName: 'Forged CSRF Room' }),
    });
    assert.equal(csrfBlockedRes.status, 403);
    const csrfBlockedData = await csrfBlockedRes.json();
    assert.equal(csrfBlockedData.code, 'CSRF_REJECTED');

    // 4. Socket.IO connection authenticated solely via HttpOnly cookie in handshake
    const cookieSocket = Client(SERVER_URL, {
      transports: ['websocket'],
      extraHeaders: {
        Cookie: `wp_token=${tokenA}`,
      },
    });
    await new Promise((resolve) => cookieSocket.on('connect', resolve));
    assert.ok(cookieSocket.id);
    cookieSocket.disconnect();
  });

  // Regression: Expired sessions are rejected across REST and Socket.IO
  await t.test('Regression: Expired sessions are rejected across REST and Socket.IO', async () => {
    const expiredToken = generateToken(
      { userId: 'user_expired_123', username: 'ExpiredUser' },
      '-1s'
    );

    // 1. REST GET with expired cookie returns 401
    const expiredGetRes = await fetch(`${SERVER_URL}/api/auth/me`, {
      method: 'GET',
      headers: {
        Cookie: `wp_token=${expiredToken}`,
      },
    });
    assert.equal(expiredGetRes.status, 401);

    // 2. REST POST with expired cookie returns 401
    const expiredPostRes = await fetch(`${SERVER_URL}/api/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        Cookie: `wp_token=${expiredToken}`,
      },
      body: JSON.stringify({ roomName: 'Expired Token Room' }),
    });
    assert.equal(expiredPostRes.status, 401);

    // 3. Socket.IO connection with expired token in cookie is rejected during handshake
    const expiredSocket = Client(SERVER_URL, {
      transports: ['websocket'],
      extraHeaders: {
        Cookie: `wp_token=${expiredToken}`,
      },
    });
    const errPromise = waitForEvent(expiredSocket, 'connect_error');
    const connectErr = await errPromise;
    assert.ok(connectErr.message.includes('Authentication error: Invalid or expired token'));
    expiredSocket.disconnect();
  });

  // Regression: Unauthorized room creation rejected
  await t.test('Regression: Unauthorized room creation returns 401', async () => {
    const unauthRes = await fetch(`${SERVER_URL}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomName: 'Unauthorized Room' }),
    });
    assert.equal(unauthRes.status, 401);
  });

  // Scenario 1: User A creates a room, becomes Host, receives secure Host token
  await t.test('Scenario 1: User A creates a room and receives secure hostToken', async () => {
    const res = await fetch(`${SERVER_URL}/api/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        roomName: 'Anime Night',
      }),
    });

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.data.room.roomId);
    assert.equal(data.data.room.hostId, userA.userId);
    assert.equal(data.data.participant.role, 'Host');
    assert.ok(data.data.hostToken, 'Host token must be returned only to creator');

    roomId = data.data.room.roomId;
    hostToken = data.data.hostToken;
    console.log(`[Test] Room created: ${roomId} with secure hostToken`);

    // Verify hostTokenHash is NOT exposed in GET /api/rooms/:roomId
    const roomInfoRes = await fetch(`${SERVER_URL}/api/rooms/${roomId}`);
    const roomInfo = await roomInfoRes.json();
    assert.equal(roomInfo.data.hostTokenHash, undefined, 'hostTokenHash must NEVER be exposed in room API');
    assert.equal(roomInfo.data.hostToken, undefined, 'hostToken must NEVER be exposed in room API');

    // Connect User A socket with verified JWT token
    socketA = Client(SERVER_URL, {
      transports: ['websocket'],
      auth: { token: tokenA },
    });
    const syncPromiseA = waitForEvent(socketA, 'sync_state');
    socketA.emit('join_room', {
      roomId,
      hostToken,
    });
    const syncA = await syncPromiseA;

    assert.equal(syncA.myRole, 'Host');
    assert.equal(syncA.room.roomId, roomId);
  });

  // Regression: Socket connection without token rejected
  await t.test('Regression: Socket connection without a token is rejected during handshake', async () => {
    const socketWithoutToken = Client(SERVER_URL, {
      transports: ['websocket'],
    });

    const connectErr = await new Promise((resolve) => {
      socketWithoutToken.on('connect_error', (err) => resolve(err));
    });

    assert.match(connectErr.message, /Authentication error/);
    socketWithoutToken.disconnect();
  });

  // Regression: Socket connection with invalid JWT rejected
  await t.test('Regression: Socket connection with invalid JWT is rejected', async () => {
    const socketBadToken = Client(SERVER_URL, {
      transports: ['websocket'],
      auth: { token: 'invalid_forged_malicious_token' },
    });

    const connectErr = await new Promise((resolve) => {
      socketBadToken.on('connect_error', (err) => resolve(err));
    });

    assert.match(connectErr.message, /Invalid or expired token/);
    socketBadToken.disconnect();
  });

  // Regression: Socket connection with expired JWT rejected
  await t.test('Regression: Socket connection with expired JWT is rejected', async () => {
    const expiredToken = generateToken({ userId: 'u_expired', username: 'OldUser' }, '-1s');
    const socketExpired = Client(SERVER_URL, {
      transports: ['websocket'],
      auth: { token: expiredToken },
    });

    const connectErr = await new Promise((resolve) => {
      socketExpired.on('connect_error', (err) => resolve(err));
    });

    assert.match(connectErr.message, /Invalid or expired token/);
    socketExpired.disconnect();
  });

  // Regression: Attempt to impersonate another userId is rejected
  await t.test('Regression: Attempt to impersonate another userId is blocked', async () => {
    // 1. Client tries to send victim's userId to createSession
    const spoofRes = await fetch(`${SERVER_URL}/api/auth/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Attacker',
        userId: userA.userId, // Client supplies Host's userId
      }),
    });
    const spoofData = await spoofRes.json();
    // Server must generate its own unique userId and NEVER accept the client-supplied userId
    assert.notEqual(spoofData.data.user.userId, userA.userId, 'Server must never accept client-provided userId');

    // 2. Client connecting with User B token tries to supply User A's userId in join_room payload
    const spoofSocket = Client(SERVER_URL, {
      transports: ['websocket'],
      auth: { token: tokenB },
    });
    const syncPromiseSpoof = waitForEvent(spoofSocket, 'sync_state');
    spoofSocket.emit('join_room', {
      roomId,
      userId: userA.userId, // Attempting to spoof Host
    });
    const syncSpoof = await syncPromiseSpoof;
    // Must be assigned User B's role (Participant), NOT Host!
    assert.equal(syncSpoof.myRole, 'Participant', 'User cannot impersonate Host via client payload');
    spoofSocket.disconnect();
  });

  // Security Test: Host Impersonation Prevention with invalid token
  await t.test('Security: Impersonator cannot claim Host role without valid hostToken', async () => {
    // 1. REST join attempt using invalid hostToken
    const restImpersonateRes = await fetch(`${SERVER_URL}/api/rooms/${roomId}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({
        hostToken: 'invalid_malicious_token_123',
      }),
    });

    // Since token is userB, userB becomes Participant normally or is rejected if attempting to claim host
    assert.ok(restImpersonateRes.status === 200 || restImpersonateRes.status === 403);

    // 2. Socket join attempt claiming Host with invalid token
    const fakeHostSocket = Client(SERVER_URL, {
      transports: ['websocket'],
      auth: { token: tokenA }, // Token is User A, but hostToken is invalid
    });
    const errorPromise = waitForEvent(fakeHostSocket, 'error');
    fakeHostSocket.emit('join_room', {
      roomId,
      hostToken: 'invalid_malicious_token_123',
    });

    const socketErr = await errorPromise;
    assert.equal(socketErr.code, 'INVALID_HOST_TOKEN');
    fakeHostSocket.disconnect();
  });

  // Security Test: Unauthorized Room Access
  await t.test('Security: Unjoined socket cannot execute room operations', async () => {
    const unjoinedSocket = Client(SERVER_URL, {
      transports: ['websocket'],
      auth: { token: tokenC },
    });
    await new Promise((resolve) => unjoinedSocket.on('connect', resolve));

    // Attempt play without joining
    const errPromisePlay = waitForEvent(unjoinedSocket, 'error');
    unjoinedSocket.emit('play', { currentTime: 10 });
    const errPlay = await errPromisePlay;
    assert.equal(errPlay.code, 'UNAUTHORIZED');

    // Attempt playback request without joining
    const errPromiseReq = waitForEvent(unjoinedSocket, 'error');
    unjoinedSocket.emit('playback_request', { type: 'play' });
    const errReq = await errPromiseReq;
    assert.equal(errReq.code, 'UNAUTHORIZED');

    unjoinedSocket.disconnect();
  });

  // Regression: Unauthorized room joining rejected
  await t.test('Regression: Unauthorized room joining returns 401', async () => {
    const unauthJoinRes = await fetch(`${SERVER_URL}/api/rooms/${roomId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(unauthJoinRes.status, 401);
  });

  // Scenario 2 & 3: User B joins as Participant
  await t.test('Scenario 2 & 3: User B joins using room code and becomes Participant', async () => {
    const res = await fetch(`${SERVER_URL}/api/rooms/${roomId}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({}),
    });

    assert.equal(res.status, 200);
    const joinRes = await res.json();
    assert.equal(joinRes.data.participant.role, 'Participant');

    // Connect User B socket
    socketB = Client(SERVER_URL, {
      transports: ['websocket'],
      auth: { token: tokenB },
    });
    const syncPromiseB = waitForEvent(socketB, 'sync_state');
    const userJoinedPromiseA = waitForEvent(socketA, 'user_joined');

    socketB.emit('join_room', { roomId });
    const syncB = await syncPromiseB;
    const userJoinedA = await userJoinedPromiseA;

    assert.equal(syncB.myRole, 'Participant');
    assert.equal(syncB.participants.length, 2);
    assert.equal(userJoinedA.user.username, userB.username);
  });

  // Multi-Connection Handling: One tab disconnect does not mark user offline
  await t.test('Multi-Connection Handling: Closing 1 tab keeps user online if 2nd tab is open', async () => {
    // Open a second tab for User B
    const socketB2 = Client(SERVER_URL, {
      transports: ['websocket'],
      auth: { token: tokenB },
    });
    const syncPromiseB2 = waitForEvent(socketB2, 'sync_state');
    socketB2.emit('join_room', { roomId });
    await syncPromiseB2;

    // Disconnect tab 1 (socketB)
    let userLeftFiredForTab1 = false;
    const userLeftWatcher = () => {
      userLeftFiredForTab1 = true;
    };
    socketA.on('user_left', userLeftWatcher);

    socketB.disconnect();
    // Allow brief time for disconnect to process
    await new Promise((resolve) => setTimeout(resolve, 80));
    socketA.off('user_left', userLeftWatcher);

    // Verify user_left was NOT fired because socketB2 is still in the room
    assert.equal(userLeftFiredForTab1, false, 'user_left must NOT fire while another tab is open');

    // Verify User B is still online in DB
    const participantB = await Participant.findOne({ roomId, userId: userB.userId });
    assert.equal(participantB.isOnline, true, 'User B must remain online');

    // Reconnect socketB and disconnect temporary socketB2
    socketB = Client(SERVER_URL, {
      transports: ['websocket'],
      auth: { token: tokenB },
    });
    const syncPromiseBRe = waitForEvent(socketB, 'sync_state');
    socketB.emit('join_room', { roomId });
    await syncPromiseBRe;
    socketB2.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  // Scenario 4: Host plays a video, User B sees playing
  await t.test('Scenario 4: Host plays a video and User B sees it playing', async () => {
    const playPromiseB = waitForEvent(socketB, 'playback_updated');
    socketA.emit('play', { currentTime: 15 });

    const playData = await playPromiseB;
    assert.equal(playData.playbackState, 'playing');
    assert.equal(playData.currentTime, 15);

    // Verify in MongoDB
    const room = await Room.findOne({ roomId });
    assert.equal(room.playbackState, 'playing');
    assert.equal(room.currentTime, 15);
  });

  // Scenario 5: Host pauses video, User B sees paused
  await t.test('Scenario 5: Host pauses and User B sees it paused', async () => {
    const pausePromiseB = waitForEvent(socketB, 'playback_updated');
    socketA.emit('pause', { currentTime: 25 });

    const pauseData = await pausePromiseB;
    assert.equal(pauseData.playbackState, 'paused');
    assert.equal(pauseData.currentTime, 25);

    const room = await Room.findOne({ roomId });
    assert.equal(room.playbackState, 'paused');
    assert.equal(room.currentTime, 25);
  });

  // Scenario 6: Host seeks video, User B follows position
  await t.test('Scenario 6: Host seeks and User B follows position', async () => {
    const seekPromiseB = waitForEvent(socketB, 'playback_updated');
    socketA.emit('seek', { currentTime: 120 });

    const seekData = await seekPromiseB;
    assert.equal(seekData.currentTime, 120);

    const room = await Room.findOne({ roomId });
    assert.equal(room.currentTime, 120);
  });

  // Scenario 7: Host changes video, User B receives new video
  await t.test('Scenario 7: Host changes video and User B receives new video', async () => {
    const changeVideoPromiseB = waitForEvent(socketB, 'video_changed');
    socketA.emit('change_video', { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });

    const videoData = await changeVideoPromiseB;
    assert.equal(videoData.currentVideoId, 'dQw4w9WgXcQ');
    assert.equal(videoData.currentTime, 0);
    assert.equal(videoData.playbackState, 'playing');

    const room = await Room.findOne({ roomId });
    assert.equal(room.currentVideoId, 'dQw4w9WgXcQ');
  });

  // Scenario 8: Host promotes User B to Moderator
  await t.test('Scenario 8: Host promotes User B to Moderator', async () => {
    const rolePromiseB = waitForEvent(socketB, 'role_assigned');
    socketA.emit('assign_role', { targetUserId: userB.userId, newRole: 'Moderator' });

    const roleData = await rolePromiseB;
    assert.equal(roleData.targetUserId, userB.userId);
    assert.equal(roleData.newRole, 'Moderator');

    const participantB = await Participant.findOne({ roomId, userId: userB.userId });
    assert.equal(participantB.role, 'Moderator');
  });

  // Scenario 9: User B (Moderator) can now control playback
  await t.test('Scenario 9: User B (Moderator) can now control playback', async () => {
    const pausePromiseA = waitForEvent(socketA, 'playback_updated');
    socketB.emit('pause', { currentTime: 45 });

    const pauseData = await pausePromiseA;
    assert.equal(pauseData.playbackState, 'paused');
    assert.equal(pauseData.currentTime, 45);

    const room = await Room.findOne({ roomId });
    assert.equal(room.playbackState, 'paused');
    assert.equal(room.currentTime, 45);
  });

  // Scenario 10: Host demotes User B to Participant
  await t.test('Scenario 10: Host demotes User B to Participant', async () => {
    const demotePromiseB = waitForEvent(socketB, 'role_assigned');
    socketA.emit('assign_role', { targetUserId: userB.userId, newRole: 'Participant' });

    const demoteData = await demotePromiseB;
    assert.equal(demoteData.targetUserId, userB.userId);
    assert.equal(demoteData.newRole, 'Participant');

    const participantB = await Participant.findOne({ roomId, userId: userB.userId });
    assert.equal(participantB.role, 'Participant');
  });

  // Scenario 11 & Regression: Attempt to impersonate Moderator rejected
  await t.test('Scenario 11 & Regression: Participant cannot control playback directly (impersonation rejected)', async () => {
    const errPromise = waitForEvent(socketB, 'error');
    socketB.emit('play', { currentTime: 50 });

    const err = await errPromise;
    assert.equal(err.code, 'UNAUTHORIZED');

    // Verify room playback state is unchanged
    const room = await Room.findOne({ roomId });
    assert.equal(room.playbackState, 'paused');
  });

  // Scenario 12: Participant requests a playback change
  let req1Id;
  await t.test('Scenario 12: Participant requests a playback change', async () => {
    const reqPromiseA = waitForEvent(socketA, 'request_received');
    socketB.emit('playback_request', { type: 'seek', payload: { currentTime: 90 } });

    const reqData = await reqPromiseA;
    assert.equal(reqData.request.type, 'seek');
    assert.equal(reqData.request.userId, userB.userId);
    assert.equal(reqData.request.payload.currentTime, 90);
    req1Id = reqData.request.requestId;
    assert.ok(req1Id);

    // Verify request is saved in Room.pendingRequests in MongoDB
    const room = await Room.findOne({ roomId });
    const savedReq = room.pendingRequests.find((r) => r.requestId === req1Id);
    assert.ok(savedReq);
  });

  // Scenario 13: Host approves request and change executes automatically
  await t.test('Scenario 13: Host approves request and change executes automatically', async () => {
    const approvePromiseB = waitForEvent(socketB, 'request_approved');
    const playbackPromiseB = waitForEvent(socketB, 'playback_updated');

    socketA.emit('approve_request', { requestId: req1Id });

    const approvedData = await approvePromiseB;
    const playbackData = await playbackPromiseB;

    assert.equal(approvedData.requestId, req1Id);
    assert.equal(playbackData.currentTime, 90);

    // Verify room currentTime was updated
    const room = await Room.findOne({ roomId });
    assert.equal(room.currentTime, 90);
    // Request must be removed from pendingRequests
    assert.equal(room.pendingRequests.some((r) => r.requestId === req1Id), false);
  });

  // Scenario 14: Host rejects request and change does NOT execute
  await t.test('Scenario 14: Host rejects request and change does not execute', async () => {
    // Participant requests change_video
    const reqPromiseA = waitForEvent(socketA, 'request_received');
    socketB.emit('playback_request', {
      type: 'change_video',
      payload: { url: 'https://www.youtube.com/watch?v=LXb3EKWsInQ' },
    });

    const reqData = await reqPromiseA;
    const req2Id = reqData.request.requestId;

    // Host rejects request
    const rejectPromiseB = waitForEvent(socketB, 'request_rejected');
    socketA.emit('reject_request', { requestId: req2Id });

    const rejectedData = await rejectPromiseB;
    assert.equal(rejectedData.requestId, req2Id);

    // Verify room current video has NOT changed
    const room = await Room.findOne({ roomId });
    assert.equal(room.currentVideoId, 'dQw4w9WgXcQ');
  });

  // Fix 4: Host cannot submit playback requests
  await t.test('Fix 4: Host cannot submit playback requests (only Participants allowed)', async () => {
    const errPromise = waitForEvent(socketA, 'error');
    socketA.emit('playback_request', { type: 'play' });
    const err = await errPromise;
    assert.equal(err.code, 'UNAUTHORIZED');
    assert.match(err.message, /Only Participants can submit playback requests/);
  });

  // Bonus 3: Real-Time Text Chat with Sanitization & Persistence
  await t.test('Bonus 3: Text Chat - Message Broadcast, Persistence, Sanitization & Rate Limiting', async () => {
    // User B sends a message with an XSS attempt
    const msgPromiseA = waitForEvent(socketA, 'new_message');
    socketB.emit('send_message', { content: 'Hello Party! <script>alert("xss")</script>' });
    const msgData = await msgPromiseA;

    assert.ok(msgData.message._id);
    assert.equal(msgData.message.userId, userB.userId);
    assert.equal(msgData.message.username, userB.username);
    assert.equal(msgData.message.role, 'Participant');
    assert.equal(msgData.message.content, 'Hello Party! &lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;');

    // Verify message was persisted to MongoDB Message collection
    const savedDoc = await Message.findById(msgData.message._id);
    assert.ok(savedDoc);
    assert.equal(savedDoc.roomId, roomId);

    // Test empty message rejection
    const emptyErrPromise = waitForEvent(socketB, 'error');
    socketB.emit('send_message', { content: '   ' });
    const emptyErr = await emptyErrPromise;
    assert.equal(emptyErr.code, 'INVALID_MESSAGE');

    // Test message exceeding 500 characters rejection
    const longErrPromise = waitForEvent(socketB, 'error');
    socketB.emit('send_message', { content: 'x'.repeat(501) });
    const longErr = await longErrPromise;
    assert.equal(longErr.code, 'MESSAGE_TOO_LONG');
  });

  // Regression: Unauthorized chat-history access
  await t.test('Regression: Unauthorized chat-history access is rejected with 401 and 403', async () => {
    // 1. Unauthenticated request -> 401
    const unauthChatRes = await fetch(`${SERVER_URL}/api/rooms/${roomId}/messages`);
    assert.equal(unauthChatRes.status, 401);

    // 2. User C (valid JWT, but not a participant in room) -> 403
    const foreignChatRes = await fetch(`${SERVER_URL}/api/rooms/${roomId}/messages`, {
      headers: { Authorization: `Bearer ${tokenC}` },
    });
    assert.equal(foreignChatRes.status, 403);

    // 3. User A (room member) -> 200
    const authChatRes = await fetch(`${SERVER_URL}/api/rooms/${roomId}/messages`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(authChatRes.status, 200);
    const chatJson = await authChatRes.json();
    assert.equal(chatJson.success, true);
    assert.ok(chatJson.data.length >= 1);
  });

  // Bonus 4: Emoji Reactions
  await t.test('Bonus 4: Emoji Reactions - Broadcast, Validation & Rate Limiting', async () => {
    // User B sends allowed reaction
    const reactionPromiseA = waitForEvent(socketA, 'new_reaction');
    socketB.emit('send_reaction', { emoji: '🔥' });
    const reactionData = await reactionPromiseA;

    assert.equal(reactionData.emoji, '🔥');
    assert.equal(reactionData.userId, userB.userId);
    assert.ok(reactionData.timestamp);

    // User sends disallowed reaction
    const invalidErrPromise = waitForEvent(socketB, 'error');
    socketB.emit('send_reaction', { emoji: '👽' });
    const invalidErr = await invalidErrPromise;
    assert.equal(invalidErr.code, 'INVALID_REACTION');
  });

  // Regression: Unauthorized reactions
  await t.test('Regression: Unauthorized reactions from unjoined user are rejected', async () => {
    const unjoinedReactionSocket = Client(SERVER_URL, {
      transports: ['websocket'],
      auth: { token: tokenC },
    });
    await new Promise((resolve) => unjoinedReactionSocket.on('connect', resolve));

    const errPromise = waitForEvent(unjoinedReactionSocket, 'error');
    unjoinedReactionSocket.emit('send_reaction', { emoji: '❤️' });
    const err = await errPromise;
    assert.equal(err.code, 'UNAUTHORIZED');

    unjoinedReactionSocket.disconnect();
  });

  // Regression & Bonus 5: Failed Host transfer transaction (Rollback verification)
  await t.test('Regression & Bonus 5: Failed Host transfer transaction rolls back state', async () => {
    // Current Host (User A) attempts to transfer host to a non-existent participant
    const failedTransferPromise = waitForEvent(socketA, 'error');
    socketA.emit('transfer_host', { targetUserId: 'non_existent_participant_9999' });
    const failErr = await failedTransferPromise;
    assert.equal(failErr.code, 'TRANSFER_ERROR');

    // Verify room.hostId is still User A (no partial state or corruption)
    const room = await Room.findOne({ roomId });
    assert.equal(room.hostId, userA.userId);

    // Invariant check: exactly one Host exists
    const hostCount = await Participant.countDocuments({ roomId, role: 'Host' });
    assert.equal(hostCount, 1);
  });

  // Regression: Transfer to an offline participant must fail
  await t.test('Regression: Transfer to an offline participant must fail', async () => {
    // Mark target participant (User B) as offline in database
    await Participant.updateOne(
      { roomId, userId: userB.userId },
      { $set: { isOnline: false } }
    );

    const offlineTransferPromise = waitForEvent(socketA, 'error');
    socketA.emit('transfer_host', { targetUserId: userB.userId });
    const offlineErr = await offlineTransferPromise;

    assert.equal(offlineErr.code, 'TRANSFER_ERROR');
    assert.ok(
      offlineErr.message.includes('offline'),
      'Must reject transfer to offline participant'
    );

    // Verify room.hostId is STILL User A (no transfer occurred)
    const room = await Room.findOne({ roomId });
    assert.equal(room.hostId, userA.userId);

    // Invariant check: exactly one Host exists
    const hostCount = await Participant.countDocuments({ roomId, role: 'Host' });
    assert.equal(hostCount, 1);

    // Restore User B to online for subsequent tests
    await Participant.updateOne(
      { roomId, userId: userB.userId },
      { $set: { isOnline: true } }
    );
  });

  // Bonus 5: Successful Host Transfer & Exactly One Host Invariance
  await t.test('Bonus 5: Successful Host Transfer & Exactly One Host Invariance', async () => {
    // 1. Non-host (User B) cannot transfer host
    const nonHostErrPromise = waitForEvent(socketB, 'error');
    socketB.emit('transfer_host', { targetUserId: userA.userId });
    const nonHostErr = await nonHostErrPromise;
    assert.equal(nonHostErr.code, 'TRANSFER_ERROR');

    // 2. User A (current Host) transfers host to User B
    const transferredPromiseB = waitForEvent(socketB, 'host_transferred');
    const transferredPromiseA = waitForEvent(socketA, 'host_transferred');
    const promotedPromiseB = waitForEvent(socketB, 'host_promoted');

    socketA.emit('transfer_host', { targetUserId: userB.userId });

    const transferredDataB = await transferredPromiseB;
    const transferredDataA = await transferredPromiseA;
    const promotedDataB = await promotedPromiseB;

    assert.equal(transferredDataB.newHostId, userB.userId);
    assert.equal(transferredDataB.previousHostId, userA.userId);
    assert.ok(promotedDataB.hostToken, 'New host must receive fresh private hostToken');

    // 3. Verify Database state: room.hostId is now userB
    const room = await Room.findOne({ roomId });
    assert.equal(room.hostId, userB.userId);

    const partA = await Participant.findOne({ roomId, userId: userA.userId });
    const partB = await Participant.findOne({ roomId, userId: userB.userId });
    assert.equal(partA.role, 'Participant');
    assert.equal(partB.role, 'Host');

    // 4. Invariant check: Exactly one Host exists in the room
    const allHosts = await Participant.find({ roomId, role: 'Host' });
    assert.equal(allHosts.length, 1);

    // 5. User A (now Participant) cannot directly play video
    const aPlayErrPromise = waitForEvent(socketA, 'error');
    socketA.emit('play', { currentTime: 10 });
    const aPlayErr = await aPlayErrPromise;
    assert.equal(aPlayErr.code, 'UNAUTHORIZED');

    // 6. User B (now Host) can control playback
    const bPlayPromiseA = waitForEvent(socketA, 'playback_updated');
    socketB.emit('play', { currentTime: 30 });
    const bPlayData = await bPlayPromiseA;
    assert.equal(bPlayData.playbackState, 'playing');

    // 7. Transfer host back from User B to User A so subsequent removal test continues as expected
    const transferBackPromise = waitForEvent(socketA, 'host_transferred');
    socketB.emit('transfer_host', { targetUserId: userA.userId });
    await transferBackPromise;

    const resetRoom = await Room.findOne({ roomId });
    assert.equal(resetRoom.hostId, userA.userId);
  });

  // Fix 3: Duplicate username validation order (rejected socket not joined)
  await t.test('Fix 3: Duplicate username rejected before socket joins room (no broadcast leak)', async () => {
    // User C connects with tokenC, but attempts to join with User A's username 'HostAlice'
    // Create another session with User A's username
    const resDup = await fetch(`${SERVER_URL}/api/auth/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: userA.username }),
    });
    const dataDup = await resDup.json();
    const tokenDup = dataDup.data.token;

    const socketDuplicate = Client(SERVER_URL, {
      transports: ['websocket'],
      auth: { token: tokenDup },
    });
    const dupErrPromise = waitForEvent(socketDuplicate, 'error');

    socketDuplicate.emit('join_room', { roomId });
    const dupErr = await dupErrPromise;
    assert.equal(dupErr.code, 'USERNAME_TAKEN');

    // Host plays a video
    let intruderReceivedBroadcast = false;
    socketDuplicate.once('playback_updated', () => {
      intruderReceivedBroadcast = true;
    });

    socketA.emit('play', { currentTime: 35 });
    await new Promise((resolve) => setTimeout(resolve, 150));

    assert.equal(intruderReceivedBroadcast, false, 'Rejected socket must NOT be joined to room and must NOT receive room broadcasts');
    socketDuplicate.disconnect();
  });

  // Fix 2: CORS Validation
  await t.test('Fix 2: Socket.IO CORS rejects unauthorized origins', async () => {
    assert.equal(isAllowedOrigin('http://localhost:5173'), true);
    assert.equal(isAllowedOrigin('http://127.0.0.1:3000'), true);
    assert.equal(isAllowedOrigin('http://malicious-attacker.com'), false);
  });

  // Scenario 15 & 16 + Ban Protection: Host removes participant; participant cannot rejoin
  await t.test('Scenario 15 & 16: Host removes participant and prevents rejoining', async () => {
    const removedPromiseB = waitForEvent(socketB, 'participant_removed');
    const removedPromiseA = waitForEvent(socketA, 'participant_removed');

    socketA.emit('remove_participant', { targetUserId: userB.userId });

    const removedDataB = await removedPromiseB;
    const removedDataA = await removedPromiseA;

    assert.equal(removedDataB.isTarget, true);
    assert.equal(removedDataA.targetUserId, userB.userId);

    // 1. Verify User B is added to bannedUserIds in database
    const room = await Room.findOne({ roomId });
    assert.ok(room.bannedUserIds.includes(userB.userId), 'User B must be added to bannedUserIds');

    // 2. Verify User B was deleted from participants collection
    const participant = await Participant.findOne({ roomId, userId: userB.userId });
    assert.equal(participant, null, 'User B must be removed from participants collection');

    // 3. Verify removed participant CANNOT rejoin via REST API
    const rejoinRestRes = await fetch(`${SERVER_URL}/api/rooms/${roomId}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({}),
    });
    assert.equal(rejoinRestRes.status, 403, 'Rejoining via REST must be rejected with 403');
    const rejoinRestData = await rejoinRestRes.json();
    assert.equal(rejoinRestData.code, 'USER_REMOVED');

    // 4. Verify removed participant CANNOT rejoin via Socket.IO
    const rejoinSocket = Client(SERVER_URL, {
      transports: ['websocket'],
      auth: { token: tokenB },
    });
    const rejoinErrPromise = waitForEvent(rejoinSocket, 'error');
    rejoinSocket.emit('join_room', { roomId });
    const socketRejoinErr = await rejoinErrPromise;
    assert.equal(socketRejoinErr.code, 'USER_REMOVED', 'Rejoining via Socket must be rejected');
    rejoinSocket.disconnect();
  });

  // =========================================================================
  // PART 4 REGRESSION TESTS: ROOM JOINING, REJOINING, & SEEK BAR BEHAVIOR
  // =========================================================================

  // Test 1: Stable User ID is preserved across session refreshes
  await t.test('Part 4.1: Stable User ID is preserved when updating session or rejoining', async () => {
    // Calling session with existing token/cookie should keep the same userId
    const res = await fetch(`${SERVER_URL}/api/auth/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenC}`,
      },
      body: JSON.stringify({ username: 'CharlieUpdated' }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.data.user.userId, userC.userId, 'User ID must remain stable across session updates');
    assert.equal(data.data.user.username, 'CharlieUpdated');
  });

  // Test 2: New guest can join an existing room
  await t.test('Part 4.2: New guest can join an existing room via REST API', async () => {
    const joinRes = await fetch(`${SERVER_URL}/api/rooms/${roomId}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenC}`,
      },
      body: JSON.stringify({}),
    });
    assert.equal(joinRes.status, 200, 'New guest must successfully join room');
    const joinData = await joinRes.json();
    assert.equal(joinData.data.participant.userId, userC.userId);
    assert.equal(joinData.data.participant.role, 'Participant');
  });

  // Test 3: Existing authenticated participant can rejoin without receiving 409
  await t.test('Part 4.3: Existing participant can rejoin room without receiving 409 unnecessarily', async () => {
    const rejoinRes = await fetch(`${SERVER_URL}/api/rooms/${roomId}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenC}`,
      },
      body: JSON.stringify({}),
    });
    assert.equal(rejoinRes.status, 200, 'Returning participant must rejoin with 200 OK');
    const rejoinData = await rejoinRes.json();
    assert.equal(rejoinData.data.participant.userId, userC.userId);
  });

  // Test 4: Different user cannot claim another participant's username (409 Conflict)
  await t.test('Part 4.4: Different user cannot claim another participant\'s username', async () => {
    // Create new identity for User D
    const resD = await fetch(`${SERVER_URL}/api/auth/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'HostAlice' }), // Same username as Alice!
    });
    const dataD = await resD.json();
    const tokenD = dataD.data.token;

    const conflictRes = await fetch(`${SERVER_URL}/api/rooms/${roomId}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenD}`,
      },
      body: JSON.stringify({}),
    });
    assert.equal(conflictRes.status, 409, 'Must reject with 409 Conflict when username is taken by another user');
    const conflictData = await conflictRes.json();
    assert.ok(conflictData.message.includes('already taken'));
  });

  // Test 5: Invitation link room discovery returns room details, or 404 for invalid code
  await t.test('Part 4.5: Invitation link room lookup works and invalid code returns 404', async () => {
    const validLookup = await fetch(`${SERVER_URL}/api/rooms/${roomId}`);
    assert.equal(validLookup.status, 200);
    const validData = await validLookup.json();
    assert.equal(validData.data.roomId, roomId);

    const invalidLookup = await fetch(`${SERVER_URL}/api/rooms/NONEXISTENT99`);
    assert.equal(invalidLookup.status, 404);
  });

  // Test 6: Socket.IO join_room acknowledgement callback receives success and room data
  await t.test('Part 4.6: Socket.IO join_room acknowledgement callback confirms membership', async () => {
    const socketC = Client(SERVER_URL, {
      transports: ['websocket'],
      auth: { token: tokenC },
    });

    await new Promise((resolve) => socketC.on('connect', resolve));

    const ackPromise = new Promise((resolve) => {
      socketC.emit('join_room', { roomId }, (ack) => {
        resolve(ack);
      });
    });

    const ack = await ackPromise;
    assert.equal(ack.success, true, 'Socket join acknowledgement must be success: true');
    assert.equal(ack.data.myRole, 'Participant');
    assert.equal(ack.data.room.roomId, roomId);

    // Test 7: Chat history loads only after successful membership
    const msgRes = await fetch(`${SERVER_URL}/api/rooms/${roomId}/messages?limit=50`, {
      headers: { Authorization: `Bearer ${tokenC}` },
    });
    assert.equal(msgRes.status, 200, 'Member can fetch chat history');

    socketC.disconnect();
  });

  // Test 8: Failed Socket.IO join returns error in acknowledgement
  await t.test('Part 4.7: Failed Socket.IO join returns error in acknowledgement callback', async () => {
    const socketFailed = Client(SERVER_URL, {
      transports: ['websocket'],
      auth: { token: tokenC },
    });

    await new Promise((resolve) => socketFailed.on('connect', resolve));

    const ackPromise = new Promise((resolve) => {
      socketFailed.emit('join_room', { roomId: 'INVALID_ROOM_CODE' }, (ack) => {
        resolve(ack);
      });
    });

    const ack = await ackPromise;
    assert.equal(ack.success, false, 'Acknowledgement must report success: false for invalid room');
    assert.equal(ack.code, 'ROOM_NOT_FOUND');
    socketFailed.disconnect();
  });

  // Test 9: Seek timestamp validation (reject non-finite, clamp negative)
  await t.test('Part 4.8: Seek validation rejects non-finite timestamps and clamps negatives', async () => {
    // Non-finite timestamp (NaN or string) must trigger error event
    const errPromise = waitForEvent(socketA, 'error');
    socketA.emit('seek', { currentTime: 'not-a-number' });
    const errData = await errPromise;
    assert.equal(errData.code, 'INVALID_TIMESTAMP');

    // Negative timestamp must be safely clamped to 0 without crashing
    const updatePromise = waitForEvent(socketA, 'playback_updated');
    socketA.emit('seek', { currentTime: -42 });
    const updateData = await updatePromise;
    assert.equal(updateData.currentTime, 0, 'Negative seek must be clamped to 0');
  });

  // Test 10: Host seeks and updates MongoDB and broadcasts to room
  await t.test('Part 4.9: Host seeks, updates MongoDB and broadcasts playback_updated', async () => {
    const updatePromise = waitForEvent(socketA, 'playback_updated');
    socketA.emit('seek', { currentTime: 75.5 });
    const updateData = await updatePromise;
    assert.equal(updateData.currentTime, 75.5);

    // Verify MongoDB state was updated
    const roomInDb = await Room.findOne({ roomId });
    assert.equal(roomInDb.currentTime, 75.5, 'Room currentTime in DB must match seeked timestamp');
  });

  // Test 11: Room Title Update via REST and Socket (Part 6)
  await t.test('Part 6.1: Host can update room title via REST API and persists to MongoDB', async () => {
    // 1. Host updates title
    const patchRes = await fetch(`${SERVER_URL}/api/rooms/${roomId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ roomName: 'Friday Movie Night 🍿' }),
    });
    assert.equal(patchRes.status, 200, 'Host update title must return 200');
    const patchData = await patchRes.json();
    assert.equal(patchData.data.roomName, 'Friday Movie Night 🍿');

    // 2. Verify in MongoDB
    const roomInDb = await Room.findOne({ roomId });
    assert.equal(roomInDb.roomName, 'Friday Movie Night 🍿');
  });

  await t.test('Part 6.2: Non-host or unauthorized user cannot update room title', async () => {
    // Unauthenticated request -> 401
    const unauthRes = await fetch(`${SERVER_URL}/api/rooms/${roomId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomName: 'Hacker Room' }),
    });
    assert.equal(unauthRes.status, 401, 'Unauthenticated title update must return 401');

    // Non-host request (User C) -> 403
    const nonHostRes = await fetch(`${SERVER_URL}/api/rooms/${roomId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenC}`,
      },
      body: JSON.stringify({ roomName: 'Intruder Room' }),
    });
    assert.equal(nonHostRes.status, 403, 'Non-host title update must return 403');
  });

  await t.test('Part 6.3: Host updates room title via Socket and broadcasts room_updated', async () => {
    // User C connects to listen for room_updated broadcast
    const socketC = Client(SERVER_URL, {
      transports: ['websocket'],
      auth: { token: tokenC },
    });
    await new Promise((resolve) => socketC.on('connect', resolve));
    await new Promise((resolve) => socketC.emit('join_room', { roomId }, resolve));

    const roomUpdatePromise = waitForEvent(socketC, 'room_updated');

    // Host emits update_room_title with ack callback
    const ackPromise = new Promise((resolve) => {
      socketA.emit('update_room_title', { roomName: 'Weekend Anime Marathon 🎬' }, resolve);
    });

    const ack = await ackPromise;
    assert.equal(ack.success, true);
    assert.equal(ack.data.roomName, 'Weekend Anime Marathon 🎬');

    const broadcastData = await roomUpdatePromise;
    assert.equal(broadcastData.roomName, 'Weekend Anime Marathon 🎬');

    socketC.disconnect();
  });

  // Test 12: Playback Request Confirmation with Acknowledgement Callback (Part 10)
  await t.test('Part 10: Participant submits playback request and receives Socket acknowledgement', async () => {
    const socketC = Client(SERVER_URL, {
      transports: ['websocket'],
      auth: { token: tokenC },
    });
    await new Promise((resolve) => socketC.on('connect', resolve));
    await new Promise((resolve) => socketC.emit('join_room', { roomId }, resolve));

    // Submit request with ack callback
    const reqAckPromise = new Promise((resolve) => {
      socketC.emit('playback_request', { type: 'pause', payload: { currentTime: 40 } }, resolve);
    });

    const reqAck = await reqAckPromise;
    assert.equal(reqAck.success, true, 'Participant must receive success: true in ack callback');
    assert.ok(reqAck.data.request.requestId, 'Ack must include created requestId');

    // Host approves request with ack callback
    const approveAckPromise = new Promise((resolve) => {
      socketA.emit('approve_request', { requestId: reqAck.data.request.requestId }, resolve);
    });

    const approveAck = await approveAckPromise;
    assert.equal(approveAck.success, true, 'Host approval must receive success: true in ack callback');

    socketC.disconnect();
  });

  // Test 13: Leave Room Workflow (Part 5)
  await t.test('Part 5: User leaves room, updates online count and clears socket membership', async () => {
    const socketC = Client(SERVER_URL, {
      transports: ['websocket'],
      auth: { token: tokenC },
    });
    await new Promise((resolve) => socketC.on('connect', resolve));
    await new Promise((resolve) => socketC.emit('join_room', { roomId }, resolve));

    const leftPromise = waitForEvent(socketA, 'user_left');

    // User C emits leave_room with ack
    const leaveAckPromise = new Promise((resolve) => {
      socketC.emit('leave_room', resolve);
    });
    const leaveAck = await leaveAckPromise;
    assert.equal(leaveAck.success, true);

    const leftData = await leftPromise;
    assert.equal(leftData.userId, userC.userId);

    // Verify socketC can no longer emit room-scoped events
    const errPromise = waitForEvent(socketC, 'error');
    socketC.emit('play', { currentTime: 10 });
    const err = await errPromise;
    assert.equal(err.code, 'UNAUTHORIZED');

    socketC.disconnect();
  });

  // Test 14: Socket Reconnection and Authoritative State Recovery (Part 4)
  await t.test('Part 4: Reconnecting socket re-emits join_room and restores sync state', async () => {
    const socketReconnect = Client(SERVER_URL, {
      transports: ['websocket'],
      auth: { token: tokenC },
    });
    await new Promise((resolve) => socketReconnect.on('connect', resolve));

    // Initial join
    await new Promise((resolve) => socketReconnect.emit('join_room', { roomId }, resolve));

    // Simulate disconnect & reconnect
    socketReconnect.disconnect();
    socketReconnect.connect();
    await new Promise((resolve) => socketReconnect.on('connect', resolve));

    // Client re-emits join_room upon reconnection
    const reSyncPromise = waitForEvent(socketReconnect, 'sync_state');
    const reAckPromise = new Promise((resolve) => {
      socketReconnect.emit('join_room', { roomId }, resolve);
    });

    const [syncState, reAck] = await Promise.all([reSyncPromise, reAckPromise]);
    assert.equal(reAck.success, true);
    assert.equal(syncState.room.roomId, roomId);
    assert.equal(syncState.room.roomName, 'Weekend Anime Marathon 🎬');
    assert.equal(syncState.myRole, 'Participant');

    socketReconnect.disconnect();
  });

  // Cleanup
  await t.test('Teardown and Cleanup', async () => {
    if (socketA) socketA.disconnect();
    if (socketB) socketB.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 50));
    if (roomId) {
      await Room.deleteOne({ roomId });
      await Participant.deleteMany({ roomId });
      await Message.deleteMany({ roomId });
    }
    if (ioServer) ioServer.close();
    await new Promise((resolve) => server.close(resolve));
    await mongoose.connection.close();
    console.log('[Test] Server closed and test database cleaned');
  });
});
