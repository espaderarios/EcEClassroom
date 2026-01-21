# Google Account Integration with Cloudflare

## Overview
This document describes the Google Account integration that connects Cloudflare user IDs with Google OAuth accounts for the EcE Classroom application.

## Features Implemented

### 1. Backend Changes (backend/src/index.js)

#### OAuth Callback Enhancement
- **Google ID Storage**: Users are now created with their unique Google ID (`userInfo.sub`)
- **Extended User Data**: Stores comprehensive user information including:
  - `googleId`: Google's unique identifier
  - `googleEmail`: User's Google email
  - `picture`: Profile picture URL
  - `lastLogin`: Timestamp of last login
  - `linkedUserId`: For linking local accounts to Google accounts

#### New API Endpoints

**1. POST /auth/link-google**
- Links an existing local user account to a Google account
- Parameters: `{ localUserId, googleUserId }`
- Updates both user records with linking information
- Returns: `{ success, user, linkedUser }`

**2. GET /auth/user-by-google/:googleId**
- Retrieves user information by Google ID
- Uses reverse mapping for fast lookups
- Returns: `{ user }`

#### Data Storage
- User data stored in Cloudflare KV (STUDENTS namespace)
- Reverse mapping: `google_map_{googleId}` → `{ userId, googleId, email }`
- Enables quick lookups by Google ID

### 2. Frontend Changes

#### OAuth Callback Handling (index.html)
- Captures additional URL parameters:
  - `google_id`: Google's unique identifier
  - `picture`: User's profile picture URL
- Automatic account linking support
- Updates student profile with Google information
- Handles `pending_google_link_user` for connecting existing accounts

#### Profile Management (app.js)

**Updated Functions:**

1. **`connectGoogle()`**
   - Checks if user is already connected to Google
   - Stores pending link user ID in localStorage
   - Redirects to Google OAuth flow
   - Auto-links accounts after OAuth return

2. **`disconnectGoogle()`**
   - Clears Google ID and email from profile
   - Converts Google-authenticated users to local accounts
   - Preserves local data when disconnecting
   - Creates new local user ID if needed

3. **`renderStudentProfile()`**
   - Shows Google connection status
   - Displays connected Google email
   - One-click connect/disconnect buttons
   - Visual indicators (✅ connected, 🔗 not connected)

4. **`linkGoogleAccountToLocalUser()`**
   - Backend API call to link accounts
   - Error handling for failed links

#### User Profile Structure
```javascript
{
  id: "user_id",
  name: "User Name",
  email: "user@email.com",
  googleId: "google_unique_id",
  googleEmail: "google@email.com",
  picture: "https://...",
  provider: "google",
  authenticated: true,
  linkedUserId: "local_user_id" // if linked to existing account
}
```

### 3. User Experience

#### For New Users
1. Click "Sign in with Google" on login page
2. Authenticate with Google
3. Automatically logged in with Google account
4. Google ID and email stored in Cloudflare
5. Profile picture synced

#### For Existing Local Users
1. Navigate to Profile tab
2. Click "Connect" button in Google Account section
3. Authenticate with Google
4. Local account automatically linked to Google account
5. Can now use Google sign-in to access local data

#### Account Disconnection
1. Navigate to Profile tab
2. Click "Disconnect" button
3. Confirm disconnection
4. Converts to local account
5. Local data preserved
6. Can reconnect Google account anytime

## Data Flow

### Login Flow
```
User clicks "Sign in with Google"
  ↓
Redirected to /auth/google/start
  ↓
Google OAuth authentication
  ↓
Callback to /auth/google/callback
  ↓
Backend creates/updates user with Google ID
  ↓
Stores in Cloudflare KV: STUDENTS[google_{sub}]
  ↓
Stores reverse mapping: STUDENTS[google_map_{sub}]
  ↓
Redirects to app with user data in URL params
  ↓
Frontend captures params and creates user session
  ↓
Updates student profile with Google info
```

### Account Linking Flow
```
Local user clicks "Connect" on profile
  ↓
Stores localUserId in localStorage
  ↓
Redirects to Google OAuth
  ↓
After OAuth callback, frontend detects pending link
  ↓
Calls /auth/link-google API
  ↓
Backend updates both user records
  ↓
Google user gets linkedUserId
  ↓
Local user gets googleId and googleEmail
  ↓
Both accounts now linked
```

## Security Considerations

1. **CSRF Protection**: OAuth state parameter prevents CSRF attacks
2. **Session Cookies**: HttpOnly session cookies for secure storage
3. **Data Persistence**: KV storage in Cloudflare's global network
4. **Account Linking**: Requires active session before linking
5. **Reversible**: Users can disconnect Google accounts anytime

## Configuration

### Backend Environment Variables
- `GOOGLE_CLIENT_ID`: Google OAuth client ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret
- `GOOGLE_REDIRECT_URI`: OAuth callback URL (defaults to {origin}/auth/google/callback)
- `APP_ORIGIN`: Frontend application URL (defaults to http://127.0.0.1:5500)

### Frontend Configuration
- Backend URL: `https://ec-eclassroom-backend.espaderarios.workers.dev`
- OAuth endpoint: `/auth/google/start`
- Link endpoint: `/auth/link-google`

## Storage Schema

### Cloudflare KV - STUDENTS Namespace

**User Record:**
```json
{
  "id": "google_1234567890",
  "provider": "google",
  "googleId": "1234567890",
  "googleEmail": "user@gmail.com",
  "email": "user@gmail.com",
  "name": "John Doe",
  "picture": "https://lh3.googleusercontent.com/...",
  "createdAt": "2026-01-21T...",
  "lastLogin": "2026-01-21T...",
  "linkedUserId": "local_user_123" // optional
}
```

**Reverse Mapping:**
```json
{
  "userId": "google_1234567890",
  "googleId": "1234567890",
  "email": "user@gmail.com"
}
```

### Local Storage - Frontend

**User Session:**
```javascript
localStorage.getItem('user')
// {
//   "id": "google_1234567890",
//   "name": "John Doe",
//   "email": "user@gmail.com",
//   "googleId": "1234567890",
//   "googleEmail": "user@gmail.com",
//   "picture": "https://...",
//   "provider": "google",
//   "authenticated": true
// }
```

**Student Profile:**
```javascript
localStorage.getItem('student_profile')
// {
//   "name": "John Doe",
//   "id": "student_123",
//   "email": "user@gmail.com",
//   "school": "ABC High School",
//   "grade": "10th Grade",
//   "profilePictureUrl": "https://...",
//   "googleId": "1234567890",
//   "googleEmail": "user@gmail.com"
// }
```

## Testing

### Test Scenarios

1. **New Google Login**
   - Sign in with Google for first time
   - Verify user created in Cloudflare KV
   - Verify profile populated with Google data

2. **Existing Google Login**
   - Sign in with previously used Google account
   - Verify lastLogin updated
   - Verify existing data preserved

3. **Link Local to Google**
   - Create local account
   - Add some data
   - Link to Google account
   - Verify data preserved
   - Verify both accounts linked

4. **Disconnect Google**
   - Connect Google account
   - Disconnect it
   - Verify local account created
   - Verify data preserved

5. **Reconnect Google**
   - Disconnect then reconnect same Google account
   - Verify data persists across connection cycles

## Future Enhancements

1. **Profile Picture Sync**: Auto-update from Google
2. **Email Verification**: Verify Google emails match student emails
3. **Multi-provider**: Support for Microsoft, GitHub OAuth
4. **Account Merging**: Merge multiple local accounts into one Google account
5. **Data Migration**: Bulk migrate local users to Google accounts
6. **Admin Dashboard**: View all linked accounts
7. **Audit Logging**: Track account linking/unlinking events

## Support

For issues or questions:
1. Check backend logs in Cloudflare Workers dashboard
2. Check browser console for frontend errors
3. Verify OAuth credentials in Cloudflare secrets
4. Ensure redirect URIs match in Google Cloud Console
