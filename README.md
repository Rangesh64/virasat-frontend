# Virasat Frontend

## Run

Requires Node.js/npm and Python 3. Start the backend first using its README.

Check `src/config.js` points to `http://127.0.0.1:8000`, then run from this repo:

```sh
npm run dev
```

Open http://127.0.0.1:5173/src/landing-page/index.html. Click **Sign In → Continue with Google**, choose your account and approve sign-in. You return to the dashboard. **Sign out** ends your app sessions.

Use `127.0.0.1` for both servers. Do not open the HTML file directly. If port 5173 is already in use, stop the existing server before starting another.

## Google OAuth and JWT

Google Cloud Console uses a **Web application** OAuth client, a consent screen and this authorized redirect URI:

`http://127.0.0.1:8000/auth/google/callback`

The client ID and secret stay in the backend `.env`. Set backend `FRONTEND_URL=http://127.0.0.1:5173/src/dashboard/index.html`. Add a test user in Google Console when needed.

Implemented the Google button, a configuration check, dashboard account display, logout and retry messages. The button opens the backend's Google login route. FastAPI and Authlib validate Google's callback, save/find the MongoDB user and set an HttpOnly JWT cookie. The frontend calls `/auth/me` and `/auth/logout` with cookies. Tokens stay out of JavaScript storage and redirect URLs. JWT sessions last 30 minutes; sign in again after expiry. The existing password forms are not connected in this Google sign-in integration.

## Test

```sh
npm test
```
