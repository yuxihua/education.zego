# Zego Education – Online Classroom

An online classroom web application built on [ZEGOCLOUD](https://www.zegocloud.com/), providing real-time video, audio, screen sharing and chat for teachers and students.

---

## Features

| Feature | Teacher | Student |
|---------|---------|---------|
| HD video & audio | ✅ | ✅ |
| Screen sharing | ✅ | – |
| Turn off remote camera/mic | ✅ | – |
| Remove participants | ✅ | – |
| Live chat | ✅ | ✅ |
| Up to 50 participants | ✅ | ✅ |

---

## Quick Start

### 1. Get ZEGOCLOUD credentials

1. Sign up at <https://console.zegocloud.com/>
2. Create a project.
3. Copy your **App ID** (numeric) and **Server Secret** (32-char string).

### 2. Configure the app

Open `config.js` and replace the placeholder values:

```js
var ZEGO_APP_ID        = 123456789;          // your App ID
var ZEGO_SERVER_SECRET = 'abcdef0123456789…'; // your Server Secret
```

> ⚠️ **Security note:** `config.js` is intended for local development only.  
> In production, generate the Kit Token on your **server** and serve it via a  
> secure API—never expose your Server Secret in client-side code.

### 3. Serve the files

Because the app uses ES modules and loads the ZEGOCLOUD CDN script, you need a
local HTTP server (opening `index.html` directly as a `file://` URL will not
work in most browsers).

```bash
# Python 3
python -m http.server 8080

# Node.js (npx)
npx serve .
```

Then open <http://localhost:8080> in your browser.

### 4. Join a classroom

1. Enter a **Room ID** (shared with all participants, e.g. `math-101`).
2. Enter your **name**.
3. Choose your role – **Teacher** or **Student**.
4. Click **Enter Classroom**.

---

## Project Structure

```
education.zego/
├── index.html      # Home / lobby page
├── classroom.html  # Live classroom page (ZEGOCLOUD UIKit)
├── app.js          # Lobby form logic
├── classroom.js    # Classroom initialisation & UIKit setup
├── style.css       # Shared stylesheet
└── config.js       # ZEGOCLOUD credentials (local dev only)
```

---

## Production Checklist

- [ ] Generate Kit Tokens on your back-end – never in the browser.
- [ ] Add `config.js` to `.gitignore` when it contains real credentials.
- [ ] Enable HTTPS for camera/microphone access.
- [ ] Add authentication to prevent unauthorised users from joining classes.

---

## License

MIT
