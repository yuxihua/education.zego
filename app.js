/* =========================================================
   Zego Education – Home / Lobby page logic
   ========================================================= */

(function () {
  'use strict';

  var form = document.getElementById('joinForm');
  var roomIdInput = document.getElementById('roomId');
  var userNameInput = document.getElementById('userName');
  var formError = document.getElementById('formError');

  function showError(msg) {
    formError.textContent = msg;
    formError.hidden = false;
  }

  function clearError() {
    formError.textContent = '';
    formError.hidden = true;
  }

  function sanitize(str) {
    return str.trim().replace(/[^a-zA-Z0-9 _-]/g, '');
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    clearError();

    var roomId = sanitize(roomIdInput.value);
    var userName = sanitize(userNameInput.value);
    var role = document.querySelector('input[name="role"]:checked').value;

    if (!roomId) {
      showError('Please enter a valid Room ID (letters, numbers, hyphens).');
      roomIdInput.classList.add('is-invalid');
      roomIdInput.focus();
      return;
    }

    if (!userName) {
      showError('Please enter your name.');
      userNameInput.classList.add('is-invalid');
      userNameInput.focus();
      return;
    }

    var params = new URLSearchParams({
      roomId: roomId,
      userName: userName,
      role: role
    });

    window.location.href = 'classroom.html?' + params.toString();
  });

  roomIdInput.addEventListener('input', function () {
    roomIdInput.classList.remove('is-invalid');
    clearError();
  });

  userNameInput.addEventListener('input', function () {
    userNameInput.classList.remove('is-invalid');
    clearError();
  });
}());
