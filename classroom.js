/* =========================================================
   Zego Education – Classroom page logic
   =========================================================
   Prerequisites:
     - index.html must POST/redirect here with query params:
         roomId   – unique classroom identifier
         userName – participant display name
         role     – "Teacher" | "Student"

   Environment:
     Set ZEGO_APP_ID and ZEGO_SERVER_SECRET in config.js, or
     replace the placeholder values below for local testing.
     In production, generate the Kit Token on your server.
   ========================================================= */

(function () {
  'use strict';

  /* ---- Parse URL parameters ---- */
  var params = new URLSearchParams(window.location.search);
  var roomId   = (params.get('roomId')   || '').trim();
  var userName = (params.get('userName') || '').trim();
  var role     = (params.get('role')     || 'Student');

  /* Redirect back to home if required params are missing */
  if (!roomId || !userName) {
    window.location.href = 'index.html';
    return;
  }

  /* ---- ZEGOCLOUD application credentials ----
     Replace these with your own AppID and ServerSecret
     from https://console.zegocloud.com/
     For production, generate tokens server-side.            */
  var APP_ID        = typeof ZEGO_APP_ID        !== 'undefined' ? ZEGO_APP_ID        : 0;
  var SERVER_SECRET = typeof ZEGO_SERVER_SECRET !== 'undefined' ? ZEGO_SERVER_SECRET : '';

  /* ---- Determine UIKit scenario based on role ---- */
  var scenario;
  var isTeacher = (role === 'Teacher');

  if (isTeacher) {
    scenario = {
      mode: ZegoUIKitPrebuilt.VideoConference
    };
  } else {
    scenario = {
      mode: ZegoUIKitPrebuilt.VideoConference
    };
  }

  /* ---- Generate a stable numeric user ID from the name ---- */
  var userId = generateUserId(userName + roomId);

  /* ---- Generate Kit Token (client-side only for demo) ----
     In production, call your back-end endpoint instead.     */
  var kitToken;
  try {
    kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
      APP_ID,
      SERVER_SECRET,
      roomId,
      userId,
      userName
    );
  } catch (err) {
    showConfigError();
    return;
  }

  /* ---- Mount the UIKit ---- */
  var container = document.getElementById('classroomRoot');
  var zp = ZegoUIKitPrebuilt.create(kitToken);

  zp.joinRoom({
    container: container,
    scenario: scenario,
    showScreenSharingButton: isTeacher,
    showTurnOffRemoteCameraButton: isTeacher,
    showTurnOffRemoteMicrophoneButton: isTeacher,
    showRemoveUserButton: isTeacher,
    turnOnCameraWhenJoining: isTeacher,
    turnOnMicrophoneWhenJoining: isTeacher,
    showMyMicrophoneToggleButton: true,
    showMyCameraToggleButton: true,
    showUserList: true,
    maxUsers: 50,
    layout: 'Auto',
    showLayoutButton: isTeacher,
    onLeaveRoom: function () {
      window.location.href = 'index.html';
    }
  });

  /* ---- Helpers ---- */

  /**
   * Derive a short numeric user ID from a string.
   * Not cryptographically strong – sufficient for demo use.
   */
  function generateUserId(str) {
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
      hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
    }
    return 'user_' + Math.abs(hash).toString();
  }

  /** Show a friendly error when credentials are not configured. */
  function showConfigError() {
    document.body.style.background = '#f0f4ff';
    document.body.innerHTML =
      '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'height:100vh;font-family:system-ui,sans-serif;color:#1a1a2e;text-align:center;padding:24px">' +
      '<h2 style="margin-bottom:12px;color:#dc3545">⚠️ ZEGOCLOUD credentials not configured</h2>' +
      '<p>Open <code>config.js</code> and add your <strong>APP_ID</strong> and ' +
      '<strong>SERVER_SECRET</strong> from the ' +
      '<a href="https://console.zegocloud.com/" target="_blank" rel="noopener noreferrer">' +
      'ZEGOCLOUD Console</a>.</p>' +
      '<a href="index.html" style="margin-top:24px;color:#1F6FEB">← Back to Home</a>' +
      '</div>';
  }
}());
