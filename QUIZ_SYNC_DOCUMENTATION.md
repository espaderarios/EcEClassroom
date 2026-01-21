# Cross-Device Quiz Sync Documentation

## Overview

Students and teachers can now create, save, and access their quizzes across multiple devices using their Google account. All quiz data is synchronized to Cloudflare Workers backend automatically.

## Features

### 1. **Automatic Quiz Sync to Cloud**
- When a teacher creates or edits a quiz with their Google account, it's automatically saved to Cloudflare
- Quiz data includes: title, questions, metadata, timestamps
- Both local and cloud versions are kept in sync

### 2. **Cross-Device Access**
- Sign in on any device with your Google account
- All your quizzes are immediately available
- Quiz attempts and scores are synchronized across devices
- No need to re-create quizzes on new devices

### 3. **Quiz Attempt Tracking**
- Student quiz attempts (scores, answers, timestamps) are saved to the cloud
- View your quiz history across all devices
- Teachers can see all student attempts regardless of device

### 4. **Offline Support**
- Local storage acts as a cache
- Works offline with local data
- Automatically syncs to cloud when reconnected

## Architecture

### Backend Storage (Cloudflare KV)

```
QUIZZES Namespace:
├── quiz_{quizId}: Quiz data with questions
├── quiz_{quizId}_user_{userId}: User's quiz metadata
└── quiz_{quizId}_attempt_{attemptId}: Quiz attempt record

ATTEMPTS Namespace:
├── attempt_{attemptId}: Student quiz attempt data
└── attempt_{studentId}_{quizId}_{timestamp}: Indexed attempts
```

### Frontend Storage (Local Storage)

```
localStorage:
├── teacher_quizzes_{userId}: Local quiz cache
├── studentQuizScores: Local attempt history
└── student_profile, teacherProfile: User profiles with sync metadata
```

## API Endpoints

### Quiz Management

**POST /api/quizzes** - Create or update a quiz
```json
{
  "id": "quiz_123",
  "quizId": "quiz_123",
  "title": "Biology Quiz",
  "questions": [
    {
      "question": "What is photosynthesis?",
      "options": ["...", "...", "...", "..."],
      "correct": "..."
    }
  ],
  "userId": "google_user_id",
  "userEmail": "user@gmail.com",
  "createdAt": "2026-01-21T10:00:00Z",
  "lastSyncedAt": "2026-01-21T10:05:00Z"
}
```

**GET /api/quizzes** - Get all quizzes (filters by userId if provided)
```json
[
  {
    "id": "quiz_123",
    "title": "Biology Quiz",
    "userId": "google_user_id",
    "createdAt": "2026-01-21T10:00:00Z"
  }
]
```

**GET /api/quizzes/{quizId}** - Get specific quiz with all questions
```json
{
  "id": "quiz_123",
  "title": "Biology Quiz",
  "questions": [...]
}
```

### Quiz Attempts

**POST /api/attempts** - Save a quiz attempt
```json
{
  "id": "attempt_456",
  "studentId": "google_user_id",
  "studentEmail": "student@gmail.com",
  "quizId": "quiz_123",
  "score": 8,
  "total": 10,
  "percentage": 80,
  "letterGrade": "B",
  "timestamp": "2026-01-21T10:30:00Z",
  "attemptNumber": 1
}
```

**GET /api/attempts** - Get all quiz attempts (filters by studentId)
```json
[
  {
    "id": "attempt_456",
    "quizId": "quiz_123",
    "score": 8,
    "total": 10,
    "percentage": 80,
    "timestamp": "2026-01-21T10:30:00Z"
  }
]
```

## Frontend Functions

### Quiz Syncing Functions

#### `syncQuizToBackend(quiz)`
- **Purpose**: Save quiz to Cloudflare backend
- **Parameters**: `quiz` object with id, title, questions
- **Returns**: Response from backend or null
- **Auto-triggers**: When teacher saves a quiz with Google authentication
```javascript
const result = await syncQuizToBackend({
  id: 'quiz_123',
  title: 'My Quiz',
  questions: [...]
});
```

#### `loadQuizzesFromBackend()`
- **Purpose**: Retrieve all user's quizzes from backend
- **Prerequisites**: User must be authenticated with Google
- **Returns**: Array of quizzes
- **Usage**: Called on app initialization for Google users
```javascript
const quizzes = await loadQuizzesFromBackend();
```

#### `getTeacherQuizzes()`
- **Purpose**: Get merged list of local and backend quizzes
- **Returns**: Array of quizzes sorted by creation date
- **Features**: Deduplication, merging, fallback to local storage
```javascript
const allQuizzes = await getTeacherQuizzes();
```

#### `saveQuizAttemptToBackend(attempt)`
- **Purpose**: Save student's quiz attempt to backend
- **Parameters**: Attempt object with score, answers, etc.
- **Returns**: Response from backend or null
- **Auto-triggers**: When student completes a quiz
```javascript
await saveQuizAttemptToBackend({
  quizId: 'quiz_123',
  score: 8,
  total: 10,
  answers: [...]
});
```

#### `loadStudentAttemptsFromBackend()`
- **Purpose**: Retrieve all student's quiz attempts from backend
- **Returns**: Array of attempt records
- **Usage**: Called during backend sync
```javascript
const attempts = await loadStudentAttemptsFromBackend();
```

## Usage Flow

### Teacher Creating a Quiz

1. **Device 1**
   - Teacher signs in with Google account
   - Creates new quiz with questions
   - System auto-saves to local storage
   - Simultaneously syncs to Cloudflare backend
   - Toast shows: "Quiz synced to cloud ☁️"

2. **Device 2**
   - Teacher signs in with same Google account
   - Quiz automatically appears in list
   - Questions are fully loaded from backend
   - Teacher can edit or use immediately

### Student Taking a Quiz

1. **Device 1**
   - Student signs in with Google account
   - Takes quiz and submits answers
   - Score automatically saved locally
   - Score synced to Cloudflare backend
   - Quiz attempt saved with timestamp

2. **Device 2**
   - Student signs in with same Google account
   - Quiz history shows attempt from Device 1
   - Can retake quiz and create new attempt
   - All attempts visible across devices

### Accessing After Disconnection

```javascript
// Automatic flow:
1. User signs in → initBackendSync() called
2. System checks if user authenticated with Google
3. Calls loadQuizzesFromBackend() → merges with local
4. Calls loadStudentAttemptsFromBackend() → updates scores
5. Toast shows sync status
```

## Data Consistency

### Conflict Resolution

When same quiz exists on both local and cloud:

1. **Backend takes precedence** if:
   - Backend version is newer (lastSyncedAt)
   - Backend has more complete questions
   - Multiple devices have conflicting versions

2. **Merge Strategy**:
   ```javascript
   const quizMap = new Map();
   
   // Add all backend quizzes
   backendQuizzes.forEach(q => quizMap.set(q.id, q));
   
   // Add local quizzes not in backend
   localQuizzes.forEach(q => {
     if (!quizMap.has(q.id)) {
       quizMap.set(q.id, q);
     }
   });
   
   // Result: Complete, deduplicated list
   ```

### Automatic Sync Triggers

- **Teacher creates/edits quiz** → Sync immediately
- **Student completes quiz** → Save attempt immediately
- **App initialization** → Sync all data if authenticated
- **User logs in** → Full sync of quizzes and attempts
- **User switches devices** → Auto-load from backend on login

## Security & Access Control

### Data Ownership

```javascript
// Quiz is only accessible to owner
if (quiz.userId !== currentUser.id) {
  // Reject access
}

// Attempt is only visible to student and teacher
if (attempt.studentId !== currentUser.id && attempt.teacherId !== currentUser.id) {
  // Reject access
}
```

### Authentication Required

- All sync operations require Google authentication
- User ID in token must match data owner
- No public access to quizzes or attempts

## Error Handling

### Graceful Fallback

```javascript
// If backend sync fails
try {
  const quizzes = await loadQuizzesFromBackend();
} catch (error) {
  // Use local storage instead
  const localQuizzes = getFromLocalStorage();
  console.warn('Using local data, backend unavailable');
}
```

### Offline Mode

- App works fully offline
- Uses local storage for all data
- Queues sync operations
- Syncs when reconnected

## Performance Optimization

### Caching Strategy

1. **Quiz List**: Cached locally, refreshed on app load
2. **Quiz Questions**: Loaded on-demand, cached
3. **Attempt Records**: Cached locally with backend copy
4. **User Profile**: Cached with periodic refresh

### Batch Operations

```javascript
// Load multiple data types in parallel
await Promise.all([
  loadQuizzesFromBackend(),
  loadStudentAttemptsFromBackend(),
  loadProfileFromBackend()
]);
```

## Testing Cross-Device Sync

### Test Scenario 1: Create and Access

1. Sign in on Device A (Desktop)
2. Create quiz "Physics 101"
3. Sign in on Device B (Mobile)
4. Verify quiz appears immediately
5. Verify questions load fully

### Test Scenario 2: Quiz Attempts

1. Student takes quiz on Device A
2. Score: 85%
3. Student logs in on Device B
4. Verify attempt shows in history
5. Retake quiz, verify both attempts visible

### Test Scenario 3: Offline Sync

1. Take quiz offline on Device A
2. Submit answers while offline
3. Reconnect to internet
4. Verify sync completes
5. Check Device B sees the attempt

## Future Enhancements

1. **Real-time Collaboration**: Multiple teachers editing same quiz
2. **Sync Notifications**: Notify when changes occur on other devices
3. **Version History**: Track quiz edits and maintain versions
4. **Selective Sync**: Choose which data to sync
5. **Bandwidth Optimization**: Compress large quizzes before sync
6. **Conflict Resolution UI**: Manual merge tool for conflicts

## Troubleshooting

### Quiz not syncing to backend

- [ ] Check if user is authenticated with Google
- [ ] Verify backend URL is configured correctly
- [ ] Check browser console for sync errors
- [ ] Ensure quiz has valid ID and title
- [ ] Check network connectivity

### Quiz appears on one device but not another

- [ ] Log out and log back in to force refresh
- [ ] Check if quiz owner's Google account matches
- [ ] Open app's storage inspector and verify localStorage
- [ ] Check backend logs for sync failures
- [ ] Clear browser cache and reload

### Quiz attempts not saving

- [ ] Verify student is authenticated
- [ ] Check if quiz ID exists in backend
- [ ] Ensure network connectivity for sync
- [ ] Verify localStorage has space
- [ ] Check browser console for errors

## Support

For issues or questions about cross-device quiz sync:
1. Check browser console (F12 → Console tab)
2. Review sync status in app logs
3. Check Cloudflare Workers dashboard for errors
4. Verify Google account is properly authenticated
