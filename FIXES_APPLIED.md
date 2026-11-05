# WatchParty fixes applied

## Updated
- Removed the hard-coded demo YouTube video from new rooms and client initial state. New rooms start with no video and prompt the Host/Moderator to add a YouTube link.
- Made the YouTube iframe non-interactive and hid native controls/keyboard controls. Playback is controlled through the app's synchronized controls only.
- Improved seek handling and synchronization; direct seek updates the local player and broadcasts the requested timestamp to the room.
- Removed the misleading manual quality selector. The YouTube IFrame API no longer supports forcing a resolution; the player uses YouTube's automatic adaptive quality and the UI reports the stream level when YouTube emits it.
- Added acknowledgement/error handling for reactions.
- Improved seek request validation and made the seek request dialog wait for server confirmation.
- Added acknowledgement/error handling for approving and rejecting playback requests.
- Confirmed server RBAC still allows Host and Moderator to control playback/review requests, while Participants must request changes. Only Host can promote/demote roles.

## Not changed
- Room chat files and chat event handlers were not modified.

## Validation
- Client production build completed successfully with Vite (1693 modules transformed).
- All server JavaScript files passed `node --check`.
- Live multi-browser playback, MongoDB-backed integration tests, and actual YouTube adaptive quality behavior were not executable/verified in this environment. Please test with one Host, one Moderator, and one Participant in separate browser sessions.


## Follow-up fixes (refresh / roles / host transfer)
- Fixed the WatchRoom bootstrap race: public room metadata no longer sets the active room ID before Socket.IO confirms membership. This prevents the React effect from cancelling the join during page refresh.
- Refresh now restores the complete authoritative snapshot from the Socket.IO join acknowledgement: room name, current video, playback state/time, host ID, current role, participants, online count, and pending playback requests.
- Socket listeners are bound once per socket instead of calling `removeAllListeners()` on every room join. This preserves listeners owned by other hooks and prevents role/reconnect events from silently disappearing.
- Socket connection is awaited before sending `join_room`; reconnects rejoin the active room and restore the snapshot again.
- Promoted/demoted roles and Host transfers now update each connected client's role and participant list immediately. Host transfer also updates the Host ID and securely stores the new Host token on the recipient client.
- YouTube player event handlers now read the latest role and callbacks, so a promotion/demotion takes effect without refreshing the page.
- Removed the duplicate REST join from the direct room-refresh flow; the socket join is the single authoritative membership operation.
- Added acknowledgement handling for role assignment and Host transfer so failures are surfaced instead of silently leaving stale-looking UI.
- Fixed the undefined `initializedRoomRef` reference in the name-entry join flow.

## Follow-up validation
- Client production build completed successfully after the follow-up changes.
- All backend source files pass `node --check`.
- Backend integration tests could not complete because MongoDB is not running in this environment (`ECONNREFUSED` on localhost:27017). Live Host/Moderator/Participant browser testing is still required.


## Follow-up fixes (approved seek / refresh autoplay / quality UI)
- Approved seek requests now emit a dedicated `seek_applied` event after the room document is saved. The event carries the exact target timestamp and playback state.
- The client stores the approved seek as a one-time command and calls the YouTube iframe `seekTo()` directly for each connected viewer. The normal playback sync path remains active as a drift correction fallback.
- Approved seek commands are cleared when applying a fresh room snapshot so a previous room's seek cannot replay in a newly joined room.
- When YouTube/browser policy blocks unmuted autoplay after refresh, the player now mutes and retries playback automatically. The existing in-app unmute control lets the viewer restore audio after playback begins.
- Removed the non-functional Quality label from the bottom playback toolbar.
- The YouTube IFrame API does not expose a quality-only control. `controls=0` hides the full native control bar; `controls=1` shows YouTube's full controls (including play/pause). The API also no longer supports forcing playback resolution. The project therefore keeps native controls hidden to preserve Host/Moderator-only controls rather than exposing native Play/Pause to Participants.

## Follow-up validation
- Vite production build passed (1693 modules transformed).
- All backend source files passed `node --check`.
- MongoDB-backed integration test could not run because MongoDB is not available in this environment (`ECONNREFUSED` on localhost:27017).
- Live testing of Host-approved seek and browser autoplay behavior still needs to be done with multiple browser sessions.

## Follow-up fixes (approved seek target and room leave)
- Fixed the bottom-bar Participant `Request Seek` button: it previously submitted the current playback position, which made an approval appear to do nothing. It now opens a timestamp form and sends the explicitly selected target time.
- Approved seek handling now uses one dedicated `seek_applied` event rather than sending a generic `playback_updated` immediately before it. The event includes the approved target timestamp and requester identity.
- The YouTube player now retries an approved `seekTo()` while the iframe is switching/loading the room video, verifies the resulting position, and holds the approved target in the visible seek bar while the iframe completes the operation.
- The active Participants roster now contains only records with `isOnline: true`. Offline participant documents remain in MongoDB so they can rejoin with their previous role, but they no longer appear in the live Participants panel or active participants endpoint.
- `leave_room` now awaits Socket.IO room removal, updates the participant's online state, broadcasts `user_left` with the updated live roster/count, and acknowledges the client only after cleanup.
- The client waits for the leave acknowledgement, clears the active room reference before waiting (preventing reconnect auto-join), disconnects the room socket, and resets room playback/participant state.
- Explicit Leave Room navigation now replaces the current browser history entry, so pressing Back does not restore the previous `/room/:roomId` page and auto-join it again.
- No room-chat component, REST message logic, or chat socket handler was changed.

## Follow-up validation (approved seek / leave)
- Client production build passed with Vite (1693 modules transformed).
- All backend source JavaScript files passed `node --check`.
- Backend integration tests were attempted but could not start because MongoDB is not running in this environment (`ECONNREFUSED` on localhost:27017).
- Live Host/Participant multi-browser seek approval, leave presence, and browser Back behavior still need a real browser + MongoDB test.
