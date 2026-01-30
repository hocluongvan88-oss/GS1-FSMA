# Zalo Mini App - API Integration Mapping

## Overview
This document describes how the Zalo Mini App maps to the Next.js API routes that were tested and verified working.

## API Endpoints

### Voice Processing
**Test Page:** `/app/zalo-test/page.tsx`
**Zalo Component:** `/zalo-mini-app/components/VoiceRecorder.tsx`
**API Route:** `/app/api/voice/process/route.ts`

**Request Format:**
```json
{
  "mockTranscript": "Nhận 50kg cà chua",
  "userId": "zalo-user-test",
  "userName": "Zalo User",
  "locationGLN": "8412345678901"
}
```

**Response Format:**
```json
{
  "success": true,
  "eventId": "uuid",
  "extractedData": {
    "productName": "cà chua",
    "quantity": 50,
    "unit": "kg",
    "action": "nhap"
  }
}
```

### Vision Processing
**Test Page:** `/app/zalo-test/page.tsx`
**Zalo Component:** `/zalo-mini-app/components/CameraCapture.tsx`
**API Route:** `/app/api/vision/process/route.ts`

**Request Format:**
```json
{
  "imageBase64": "data:image/jpeg;base64,...",
  "processingType": "both",
  "userId": "zalo-user-test",
  "userName": "Zalo User",
  "locationGLN": "8412345678901"
}
```

**Response Format:**
```json
{
  "success": true,
  "extractedData": {
    "detectedText": "...",
    "objectCount": 5
  }
}
```

## Changes Made

### 1. VoiceRecorder.tsx
- **OLD:** Called Supabase Edge Function `process-voice-input`
- **NEW:** Calls Next.js API route `/api/voice/process`
- **Data:** Uses `mockTranscript` instead of `audioUrl` (matching test page)

### 2. CameraCapture.tsx
- **OLD:** Called Supabase Edge Function `process-vision-input`
- **NEW:** Calls Next.js API route `/api/vision/process`
- **Data:** Sends `imageBase64` instead of uploading to storage first

### 3. index.tsx
- **Updated:** Callback signatures to match new component outputs
- **Updated:** Alert messages to show extracted data properly

## Data Flow

```
Zalo Mini App Component
  ↓
Next.js API Route (/api/voice/process or /api/vision/process)
  ↓
Gemini AI Processing
  ↓
Database Insert (events table)
  ↓
Response to Zalo App
```

## Testing Checklist

- [x] Voice recording calls correct API endpoint
- [x] Vision capture calls correct API endpoint
- [x] Request format matches test page
- [x] Response handling matches test page
- [x] User info (userId, userName, locationGLN) properly passed
- [x] Success/error alerts display correctly

## Notes

- Mock transcript used for now - real audio transcription to be added later
- Image processing uses base64 encoding instead of storage upload
- All API routes use CORS headers for cross-origin requests
- Authentication handled via localStorage for user context
