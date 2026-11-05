export const ROLES = {
  HOST: 'Host',
  MODERATOR: 'Moderator',
  PARTICIPANT: 'Participant',
};

/**
 * Checks if a given role can directly control video playback (play, pause, seek, change_video).
 * Only Host and Moderator can control playback.
 */
export const canControlPlayback = (role) => {
  return role === ROLES.HOST || role === ROLES.MODERATOR;
};

/**
 * Checks if a given role can assign/modify roles.
 * Only Host can promote/demote participants.
 */
export const canManageRoles = (role) => {
  return role === ROLES.HOST;
};

/**
 * Checks if a given user can remove another participant.
 * Only Host can remove other participants. Host cannot be removed.
 */
export const canRemoveParticipant = (requesterRole, targetRole) => {
  if (targetRole === ROLES.HOST) {
    return false; // Host can never be removed
  }
  return requesterRole === ROLES.HOST;
};

/**
 * Checks if a given role can approve or reject playback requests.
 * Host and Moderator can approve/reject.
 */
export const canReviewRequests = (role) => {
  return role === ROLES.HOST || role === ROLES.MODERATOR;
};

/**
 * Checks if a given role can submit playback requests.
 * Participants can submit requests.
 */
export const canSubmitRequests = (role) => {
  return role === ROLES.PARTICIPANT;
};

