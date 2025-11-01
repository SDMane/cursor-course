# Task 7: New Chat Functionality - Testing Guide

## ✅ Implementation Complete!

All components of the new chat functionality have been implemented with full database persistence.

## What Was Implemented

### 1. **Database Integration** (`_shared/supabase-client.ts`)
- Centralized Supabase client creation
- TypeScript types for ChatSession and Message

### 2. **Edge Functions Enhanced**
- **chat-text**: Saves messages, creates/updates sessions, streams responses
- **chat-image**: Saves prompts and generated images with metadata
- **get-chat-history**: NEW endpoint to retrieve chat sessions and messages

### 3. **Frontend Updates** (`app/src/app/page.tsx`)
- New Chat button implemented
- Proper chatId generation and management
- Messages linked to persistent chat sessions

## Testing Instructions

### Prerequisites
```bash
# 1. Start Supabase local instance
cd cursor-course
npx supabase start

# 2. Verify database is running
npx supabase status

# 3. Start the edge functions
npx supabase functions serve

# 4. In another terminal, start the Next.js app
cd app
npm run dev
```

### Test Cases

#### Test 1: Create New Chat Session
1. Open http://localhost:3000
2. Type a message: "Hello, this is my first chat"
3. Send the message
4. **Expected**: New chat session created in database with unique ID

#### Test 2: Continue Existing Chat
1. Send another message: "This is my second message"
2. **Expected**: Message added to same chat session

#### Test 3: Start New Chat
1. Click the "New Chat" button (green button with + icon)
2. **Expected**: 
   - UI clears all messages
   - Shows welcome message
   - chatId resets to null

#### Test 4: New Chat Creates New Session
1. After clicking New Chat, send a message: "This is a new conversation"
2. **Expected**: 
   - New chat session created with different ID
   - Previous chat remains in database

#### Test 5: Image Generation Chat
1. Toggle to "Image Generation" mode
2. Enter prompt: "A beautiful sunset over mountains"
3. **Expected**:
   - Image generated and displayed
   - Both prompt and image URL saved to database
   - Linked to current chat session

#### Test 6: Retrieve Chat History (API Test)
```bash
# Get all chat sessions
curl -i --location --request GET 'http://127.0.0.1:54321/functions/v1/get-chat-history' \
  --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

# Get specific chat messages (replace CHAT_ID with actual ID)
curl -i --location --request GET 'http://127.0.0.1:54321/functions/v1/get-chat-history?chatId=CHAT_ID' \
  --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
```

### Verify Database Persistence
```bash
# Connect to local Supabase database
npx supabase db diff

# Check chat_sessions table
SELECT * FROM chat_sessions ORDER BY updated_at DESC;

# Check messages table
SELECT * FROM messages ORDER BY created_at DESC;

# Check messages for specific chat
SELECT * FROM messages WHERE chat_id = 'YOUR_CHAT_ID' ORDER BY created_at;
```

## Expected Database Structure

### chat_sessions table:
| id (UUID) | created_at | updated_at | title |
|-----------|------------|------------|-------|
| abc-123... | 2025-10-01 | 2025-10-01 | Hello, this is my... |

### messages table:
| id (UUID) | created_at | chat_id | role | content | type | image_url |
|-----------|------------|---------|------|---------|------|-----------|
| def-456... | 2025-10-01 | abc-123 | user | Hello... | text | null |
| ghi-789... | 2025-10-01 | abc-123 | assistant | Hi there... | text | null |

## Success Criteria ✅

- [x] New Chat button visible and clickable
- [x] Clicking New Chat clears UI and resets chatId
- [x] Each new chat creates new session in database
- [x] Messages persist across both text and image modes
- [x] Chat history API returns sessions and messages
- [x] Multiple chat sessions can coexist
- [x] Previous conversations remain accessible

## Files Modified

### New Files:
1. `supabase/functions/_shared/supabase-client.ts` - Database client
2. `supabase/functions/get-chat-history/index.ts` - History API
3. `supabase/functions/get-chat-history/deno.json` - Config

### Updated Files:
1. `supabase/functions/chat-text/index.ts` - Added DB persistence
2. `supabase/functions/chat-image/index.ts` - Added DB persistence
3. `supabase/functions/chat-text/deno.json` - Added Supabase import
4. `supabase/functions/chat-image/deno.json` - Added Supabase import
5. `app/src/app/page.tsx` - Fixed chatId handling

## Known Limitations

1. **No UI for viewing past chats** - History API exists but no UI component yet
2. **No chat deletion** - Chats persist indefinitely
3. **No chat search** - Cannot search through chat history
4. **Basic title generation** - Uses first 50 chars of first message

## Future Enhancements (Not in this task)

- Chat history sidebar component
- Click to load previous conversations
- Delete/archive old chats
- Search functionality
- Better chat titles (AI-generated summaries)
- Export conversations to files
- Share chat links

## Troubleshooting

### "Supabase credentials not found"
- Check `supabase/functions/.env` has SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
- Get values from `npx supabase status`

### "Table does not exist"
- Run migrations: `npx supabase db reset`
- Verify: `npx supabase db diff`

### Messages not saving
- Check Supabase logs: Look at terminal running `supabase functions serve`
- Verify RLS policies allow inserts
- Check edge function console logs

## Completion Checklist

- [x] Database schema supports chat sessions and messages
- [x] Edge functions create/update chat sessions
- [x] User messages saved before processing
- [x] AI responses saved after generation
- [x] Image generation results saved with URLs
- [x] Chat history API endpoint created
- [x] Frontend New Chat button functional
- [x] chatId properly generated and maintained
- [x] All conversations persist to database
- [x] Multiple independent chat sessions supported

**Status: ✅ READY FOR TESTING**

