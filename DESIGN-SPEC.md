# PolicyBuddies UI/UX Design Specification

**For: Design Team (Figma)**  
**Date:** March 7, 2026  
**Version:** 1.0

---

## 📋 Table of Contents

1. [Product Overview](#product-overview)
2. [User Flows](#user-flows)
3. [Key Features](#key-features)
4. [API Integration](#api-integration)
5. [UI Components](#ui-components)
6. [Data Models](#data-models)
7. [Design System](#design-system)
8. [User Personas](#user-personas)
9. [Wireframes / User Stories](#wireframes--user-stories)
10. [Technical Integration](#technical-integration)

---

## 🎯 Product Overview

### What is PolicyBuddies?

PolicyBuddies is an **AI-powered insurance Q&A assistant** that helps users understand their insurance policies through intelligent conversation.

### Core Value Proposition

- **Ask questions** about insurance policies in natural language
- **Get intelligent answers** powered by LLM + retrieval-augmented generation
- **Understand policies** without reading 100+ page documents
- **Clarifying conversation** - system asks back if it needs more context

### Target Users

1. **Insurance Customers** - Want to understand their policies
2. **Customer Service Agents** - Need quick policy information
3. **Insurance Brokers** - Selling/explaining products
4. **Internal Admins** - Ingesting/managing policy documents

---

## 🔄 User Flows

### Flow 1: Customer Asking a Question (Main Flow)

```
Start
  ↓
[Enter Question Screen]
  ├─ User types: "What is covered under my policy?"
  ├─ System detects intent + product
  └─ System may ask clarifying questions
          ↓
    [Clarification Screen] (optional)
    ├─ "Which coverage level are you asking about?"
    ├─ "Standard, Premium, or Deluxe?"
    └─ User selects
          ↓
[Answer Screen]
├─ Display AI-generated answer
├─ Show confidence score
├─ Show source documents
├─ Show "Ask Follow-up" button
└─ User can follow up or start new question
      ↓
    [Follow-up Flow]
    └─ Continue conversation
      ↓
End
```

### Flow 2: Admin Ingesting Document

```
Start → [Login] → [Admin Dashboard] → [Ingest Document]
  ↓
[Upload File]
├─ Select PDF/document
├─ Enter metadata (product name, jurisdiction, version)
└─ Click "Ingest"
  ↓
[Processing Screen]
├─ Show progress bar
├─ "Extracting text..."
├─ "Chunking document..."
├─ "Generating embeddings..."
└─ "Storing vectors..."
  ↓
[Success Screen]
├─ "Document ingested successfully!"
├─ "42 chunks created"
├─ "42 vectors stored"
└─ Option to ingest another or return to dashboard
  ↓
End
```

---

## ✨ Key Features

### 1. Question & Answer Interface

```
┌─────────────────────────────────────┐
│  PolicyBuddies                 ☰  ⚙️ │
├─────────────────────────────────────┤
│                                     │
│  "What is Wealth Pro II?"           │
│                                     │
│  [Search/Input Field]               │
│  [Ask Button]                       │
│                                     │
├─────────────────────────────────────┤
│ Previous Questions                  │
│ • What are investment options?      │
│ • How do I claim benefits?          │
│ • What is the coverage amount?      │
└─────────────────────────────────────┘
```

**Key Elements:**
- Text input field (large, prominent)
- Ask button (primary action)
- Search/filter by product
- Previous conversations/history
- Product filter/selector

---

### 2. Answer Display

```
┌─────────────────────────────────────┐
│ Question: "What is covered?"        │
├─────────────────────────────────────┤
│                                     │
│ ✓ Confidence: 92%                   │
│                                     │
│ Answer:                             │
│ ───────────────────────────────────  │
│ Wealth Pro II covers...             │
│ (Answer text, 2-3 paragraphs)       │
│                                     │
│ Featured Source:                    │
│ 📄 Wealth Pro II - Product Summary  │
│                                     │
│ [Ask Follow-up] [New Question]      │
└─────────────────────────────────────┘
```

**Key Elements:**
- Answer text (readable, formatted)
- Confidence indicator (0-100%)
- Source document display
- Follow-up question button
- Source chunks/references

---

### 3. Clarification Dialog

**When system needs more context:**

```
┌─────────────────────────────────────┐
│ Need More Info                    ✕ │
├─────────────────────────────────────┤
│                                     │
│ Which coverage level?               │
│                                     │
│ ○ Standard                          │
│ ○ Premium (Recommended)             │
│ ○ Deluxe                            │
│ ○ Not Sure                          │
│                                     │
│          [Cancel]  [Confirm]        │
└─────────────────────────────────────┘
```

**Key Elements:**
- Clear question
- Multiple choice buttons
- Cancel/Confirm actions
- Helpful hint text

---

### 4. Document Management (Admin)

```
┌─────────────────────────────────────┐
│ Indexed Documents              ⬇️   │
├─────────────────────────────────────┤
│                                     │
│ Wealth Pro II (v1.0) 🇸🇬            │
│ 42 chunks | 42 vectors              │
│ Indexed: Mar 7, 2026                │
│ [View] [Delete] [Reindex]           │
│                                     │
│ Basic Coverage (v2.0) 🇸🇬           │
│ 28 chunks | 28 vectors              │
│ Indexed: Mar 5, 2026                │
│ [View] [Delete] [Reindex]           │
│                                     │
│ [+ Upload New Document]             │
└─────────────────────────────────────┘
```

**Key Elements:**
- Document cards
- Metadata (product, version, jurisdiction)
- Chunk/vector counts
- Action buttons
- Upload button

---

## 🔌 API Integration

### Request/Response Examples for Frontend

#### 1. Ask Question Request

```json
{
  "question": "What is the minimum coverage amount?",
  "topK": 3,
  "sessionId": "session_abc123"
}
```

**Response:**

```json
{
  "success": true,
  "question": "What is the minimum coverage amount?",
  "answer": "The minimum coverage amount is $50,000, though...",
  "confidence": 0.87,
  "sources": [
    {
      "chunk": "minimum coverage $50,000...",
      "score": 0.92,
      "document": "Wealth Pro II Product Summary"
    }
  ],
  "reasoning": {
    "detectedIntent": "product_specifications",
    "clarificationNeeded": false,
    "clarificationQuestions": []
  }
}
```

#### 2. Get Catalog Request

```
GET /api/catalog
```

**Response:**

```json
{
  "success": true,
  "documentCount": 3,
  "documents": [
    {
      "id": "doc_v1_abc",
      "productName": "Wealth Pro II",
      "jurisdiction": "SG",
      "versionLabel": "v1.0",
      "documentType": "product summary",
      "indexedAt": "2026-03-07T10:15:00Z"
    }
  ]
}
```

#### 3. Ingest Document Request

```json
{
  "filename": "policy.pdf",
  "content": "...(base64 or text)...",
  "metadata": {
    "productName": "Wealth Pro II",
    "jurisdiction": "SG",
    "versionLabel": "v1.0",
    "documentType": "product summary"
  }
}
```

**Response:**

```json
{
  "success": true,
  "runId": "run_123456",
  "documentVersionId": "doc_v1_abc",
  "chunksGenerated": 42,
  "vectorsStored": 42
}
```

---

## 🎨 UI Components

### Component Library Needed

#### Input Components
- [ ] Text Input (single line)
  - States: default, focused, error, disabled
  - Placeholder text support
- [ ] Text Area (multi-line)
  - For long questions
- [ ] Select Dropdown
  - Product selector
  - Version selector
- [ ] Radio Buttons
  - Clarification options
  - Coverage levels
- [ ] Checkbox
  - Filter options
- [ ] Search Input
  - Search previous questions

#### Button Components
- [ ] Primary Button
  - "Ask Question", "Submit", "Confirm"
  - States: default, hover, disabled, loading
- [ ] Secondary Button
  - "Cancel", "Skip"
- [ ] Tertiary Button
  - "View", "Delete", "Edit"
- [ ] Icon Button
  - Menu, settings, refresh

#### Display Components
- [ ] Card
  - Document card
  - Question card
- [ ] Badge
  - Confidence indicator
  - Product tag (jurisdiction)
- [ ] Message Box
  - Success message
  - Error message
  - Warning message
- [ ] Progress Indicator
  - Processing status
  - Upload progress
- [ ] Modal/Dialog
  - Clarification dialog
  - Confirmation dialog
  - Error dialog

#### Layout Components
- [ ] Header/Navigation
  - Product switcher
  - User menu
  - Settings
- [ ] Sidebar (optional)
  - Question history
  - Document list
  - Navigation
- [ ] Footer
  - Help, About, Legal

#### Data Display
- [ ] Accordion
  - Expand/collapse answer sections
- [ ] Tabs (optional)
  - Sources tab
  - Information tab
- [ ] List
  - Previous questions
  - Document list
- [ ] Table (Admin)
  - Document management

---

## 📊 Data Models

### User Session

```javascript
{
  sessionId: "session_abc123",
  startedAt: "2026-03-07T10:00:00Z",
  product: "Wealth Pro II",           // Selected product
  jurisdiction: "SG",
  conversations: [
    {
      turn: 1,
      question: "What is covered?",
      answer: "...",
      confidence: 0.87,
      sources: [...],
      timestamp: "2026-03-07T10:01:00Z"
    }
  ]
}
```

### Question/Answer

```javascript
{
  id: "qa_xyz789",
  sessionId: "session_abc123",
  question: "What is covered?",
  answer: "Wealth Pro II covers...",
  confidence: 0.87,              // 0-1.0
  detectedIntent: "coverage",
  clarificationAsked: false,
  clarificationOptions: null,
  sources: [
    {
      chunk: "coverage text...",
      score: 0.92,
      documentId: "doc_v1_abc",
      documentName: "Wealth Pro II Product Summary"
    }
  ],
  timestamp: "2026-03-07T10:01:00Z"
}
```

### Document

```javascript
{
  id: "doc_v1_abc",
  productName: "Wealth Pro II",
  jurisdiction: "SG",
  versionLabel: "v1.0",
  documentType: "product summary",
  filename: "wealth-pro-ii.pdf",
  chunkCount: 42,
  vectorCount: 42,
  indexedAt: "2026-03-07T10:15:00Z",
  status: "active"                   // active, superseded, failed
}
```

---

## 🎨 Design System

### Color Palette

| Purpose | Color | Usage |
|---------|-------|-------|
| Primary | `#0066CC` | Buttons, primary actions |
| Success | `#00AA44` | Confirmation, success states |
| Warning | `#FF9900` | Warnings, alerts |
| Error | `#CC0000` | Errors, deleted states |
| Info | `#0099FF` | Information, confidence scores |
| Neutral | `#333333` | Text, primary content |
| Light | `#F5F5F5` | Backgrounds, cards |
| Border | `#CCCCCC` | Dividers, borders |

### Typography

| Element | Font Size | Weight | Usage |
|---------|-----------|--------|-------|
| H1 | 32px | Bold | Page title |
| H2 | 24px | Bold | Section title |
| H3 | 18px | Semibold | Component title |
| Body | 14px | Regular | Main text |
| Small | 12px | Regular | Labels, hints |
| Code | 12px | Monospace | API responses |

### Spacing

- **XS:** 4px
- **S:** 8px
- **M:** 16px
- **L:** 24px
- **XL:** 32px
- **XXL:** 48px

### Icons Needed

- [ ] Help/Question mark
- [ ] Settings/Gear
- [ ] Menu/Hamburger
- [ ] Close/X
- [ ] Search/Magnifying glass
- [ ] User/Profile
- [ ] Logout/Exit
- [ ] Document/File
- [ ] Upload/Cloud
- [ ] Check/Checkmark
- [ ] Error/Alert
- [ ] Info/Exclamation
- [ ] Arrow/Chevron (up/down/left/right)
- [ ] Loading/Spinner
- [ ] Share
- [ ] Copy/Duplicate
- [ ] Delete/Trash

---

## 👥 User Personas

### Persona 1: Sarah (Customer)

- **Goal:** Understand insurance policy coverage
- **Pain:** Policies are too complex
- **Behavior:** Asks natural language questions
- **Tech Savvy:** Medium
- **Frequency:** Occasional (few times/month)

**User Journey:**
1. Opens app
2. Asks: "What's covered if I get hospitalized?"
3. Gets answer within 2 seconds
4. Follows up with clarification
5. Closes app

---

### Persona 2: Mike (Customer Service Agent)

- **Goal:** Quickly answer customer questions while on call
- **Pain:** Needs to search through documents manually
- **Behavior:** Asks specific, detailed questions
- **Tech Savvy:** Medium-High
- **Frequency:** Daily, multiple times/day

**User Journey:**
1. Customer asks about claim process
2. Mike types question into PolicyBuddies
3. Gets answer in <1 second
4. Mike refers customer to specific policy section
5. Saves time vs. manual search

---

### Persona 3: Admin (Document Manager)

- **Goal:** Keep policies up-to-date in system
- **Pain:** Managing multiple policy versions
- **Behavior:** Uploads documents regularly
- **Tech Savvy:** High
- **Frequency:** Weekly

**User Journey:**
1. New policy document released
2. Admin uploads to PolicyBuddies
3. System ingests and processes
4. Confirms success
5. Monitors usage via admin dashboard

---

## 🖼️ Wireframes / User Stories

### Screen 1: Main Question Screen

```
┌─────────────────────────────────────┐
│ PolicyBuddies              ≡  ⚙️   │ (Header)
├─────────────────────────────────────┤
│                                     │
│          Welcome!                   │
│   Ask any question about your       │
│        insurance policies           │
│                                     │
│  ┌─────────────────────────────────┐│
│  │ Product: [Wealth Pro II ▼]      ││ (Filter)
│  └─────────────────────────────────┘│
│                                     │
│  ┌─────────────────────────────────┐│
│  │ What would you like to know?    ││ (Input)
│  │                                 ││
│  │ (Type your question here...)    ││
│  └─────────────────────────────────┘│
│                                     │
│  [Ask Question]                    │ (Button)
│                                     │
├─────────────────────────────────────┤
│  Recent Questions                   │
│  • What is the coverage limit?      │
│  • How do I file a claim?           │
│  • What happens if I stop paying?   │
└─────────────────────────────────────┘
```

**User Story:**
- User lands on main screen
- Sees clear input area
- Selects product filter (optional)
- Types natural language question
- Clicks "Ask Question"

---

### Screen 2: Answer Screen

```
┌─────────────────────────────────────┐
│ PolicyBuddies              ≡  ⚙️   │
├─────────────────────────────────────┤
│ ← Back to Questions                 │
│                                     │
│ Q: What is the coverage limit?      │
│                                     │
│ ✓ Confidence: 92%                   │ (Badge)
│                                     │
│ Answer:                             │ (Content)
│ ───────────────────────────────────  │
│ Wealth Pro II provides a maximum    │
│ coverage limit of $500,000 per      │
│ year. This includes medical, dental,│
│ and vision coverage combined.       │
│                                     │
│ 📄 Source: Wealth Pro II - Summary  │ (Source)
│                                     │
│ Relevant Section:                   │
│ "Maximum annual benefit: $500,000"  │
│                                     │
│ [Ask Follow-up]  [New Question] ✕   │ (Actions)
│                                     │
└─────────────────────────────────────┘
```

**User Story:**
- Question sent to API
- Answer received with confidence score
- Source document displayed
- User can ask follow-up or new question

---

### Screen 3: Clarification Dialog

```
┌─────────────────────────────────────┐
│ Question Processing                 │
├─────────────────────────────────────┤
│                                     │
│ Need a bit more info...             │
│                                     │
│ Which coverage are you asking       │
│ about?                              │
│                                     │
│ ◯ Medical                           │
│ ◯ Dental                            │
│ ◯ Vision                            │
│ ◯ All Coverage                      │
│                                     │
│            [Cancel]  [Continue]     │
│                                     │
└─────────────────────────────────────┘
```

**User Story:**
- System detects ambiguous question
- Shows clarification dialog with options
- User selects most relevant option
- System continues with better context

---

### Screen 4: Admin Dashboard

```
┌─────────────────────────────────────┐
│ Admin Dashboard            ≡  ⚙️   │
├─────────────────────────────────────┤
│ Indexed Documents                   │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Wealth Pro II          v1.0 🇸🇬  │ │
│ │ • 42 chunks, 42 vectors         │ │
│ │ • Last indexed: Mar 7, 2026     │ │
│ │ [View] [Delete] [Reindex]       │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Basic Coverage         v2.0 🇸🇬  │ │
│ │ • 28 chunks, 28 vectors         │ │
│ │ • Last indexed: Mar 5, 2026     │ │
│ │ [View] [Delete] [Reindex]       │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [+ Upload New Document]             │
│                                     │
│ Stats:                              │
│ • Total Documents: 2                │
│ • Total Chunks: 70                  │
│ • Questions Answered Today: 42      │
│                                     │
└─────────────────────────────────────┘
```

**User Story:**
- Admin logs in
- Sees all indexed documents
- Can upload new document
- Can delete/reindex existing

---

### Screen 5: Upload/Ingest

```
┌─────────────────────────────────────┐
│ Upload Document            ✕        │
├─────────────────────────────────────┤
│                                     │
│ Select File:                        │
│ [Choose File...]  policy.pdf       │
│                                     │
│ Product Name:                       │
│ [Wealth Pro II              ▼]      │
│                                     │
│ Jurisdiction:                       │
│ [Singapore              ▼]          │
│                                     │
│ Version:                            │
│ [v1.0                  ]            │
│                                     │
│ Document Type:                      │
│ [Product Summary       ▼]           │
│                                     │
│        [Cancel]  [Upload]           │
│                                     │
│ Processing:                         │
│ [████████████░░░░░░░░] 60%         │
│ Chunking document...                │
│                                     │
└─────────────────────────────────────┘
```

**User Story:**
- Admin clicks "Upload"
- Selects file from computer
- Enters metadata
- Clicks "Upload"
- Sees processing progress
- Gets confirmation

---

## 🔧 Technical Integration

### Frontend Technology Stack (Recommendations)

**Option A: React (Recommended)**
```javascript
// src/components
// ├── Layout
// │   ├── Header.jsx
// │   ├── Sidebar.jsx (optional)
// │   └── Footer.jsx
// ├── Pages
// │   ├── AskPage.jsx (main)
// │   ├── AnswerPage.jsx
// │   ├── AdminPage.jsx
// │   └── SettingsPage.jsx
// ├── Components
// │   ├── QuestionInput.jsx
// │   ├── AnswerDisplay.jsx
// │   ├── ClarificationDialog.jsx
// │   ├── DocumentCard.jsx
// │   └── UploadForm.jsx
// └── hooks
//     ├── useQuestion.js
//     ├── useApi.js
//     └── useSession.js

// src/services
// ├── api.js (fetch wrapper)
// └── storage.js (localStorage)
```

**Option B: Vue.js**
```
// src/components
// ├── QuestionInput.vue
// ├── AnswerDisplay.vue
// ├── ClarificationDialog.vue
// └── DocumentList.vue

// src/views
// ├── AskView.vue
// ├── AdminView.vue
// └── SettingsView.vue

// src/api (Axios)
```

**Option C: Vanilla JS/HTML**
```
// For simple MVP or static site
// index.html
// styles/style.css
// js/
// ├── api.js
// ├── ui.js
// └── main.js
```

### API Endpoints Required

```javascript
// GET endpoints
GET /api/health                    // Check server status
GET /api/catalog                   // List documents
GET /api/config                    // Get config

// POST endpoints  
POST /api/ask                      // Ask question
POST /api/ingest                   // Upload document (admin only)

// Future endpoints
GET /api/history                   // User's question history
GET /api/user/profile              // User profile
POST /api/user/feedback            // Send feedback
```

### State Management

```javascript
// Global state needed
{
  user: {
    id: string,
    name: string,
    isAdmin: boolean
  },
  session: {
    id: string,
    product: string,
    jurisdiction: string,
    startedAt: timestamp
  },
  conversations: [
    {
      id: string,
      question: string,
      answer: string,
      confidence: number,
      sources: array,
      timestamp: timestamp
    }
  ],
  ui: {
    loading: boolean,
    error: string|null,
    showClarification: boolean,
    clarificationOptions: array
  }
}
```

### Storage/Persistence

```javascript
// localStorage
{
  "pb_sessionId": "session_abc123",
  "pb_product": "Wealth Pro II",
  "pb_recentQuestions": [...],
  "pb_userPreferences": {...}
}

// Optional: Backend persistence
// - User profile
// - Conversation history
// - Feedback/ratings
```

---

## 📱 Responsive Design

### Breakpoints

| Device | Width | Layout |
|--------|-------|--------|
| **Mobile** | < 768px | Single column, full width buttons |
| **Tablet** | 768px - 1024px | Single/dual column |
| **Desktop** | > 1024px | Dual column, sidebar optional |

### Mobile-First Approach

```css
/* Mobile first */
.container { width: 100%; }

/* Tablet up */
@media (min-width: 768px) {
  .container { width: 750px; }
}

/* Desktop */
@media (min-width: 1024px) {
  .container { width: 960px; }
}
```

---

## 🔐 Security & Privacy

### User Data Handling

- [ ] Questions stored securely (hashed, encrypted)
- [ ] Session IDs not exposed in URLs
- [ ] API calls over HTTPS only
- [ ] No sensitive data in localStorage
- [ ] GDPR-compliant data retention
- [ ] User can delete conversation history

### Auth (Future)

```javascript
// Login flow
POST /api/auth/login      // { email, password }
// Returns: { token, user }

// API headers
Authorization: "Bearer {token}"
```

---

## ✅ Design Checklist

Before handing to developers:

- [ ] Color palette defined and coded
- [ ] Typography scale defined
- [ ] Spacing system consistent
- [ ] Icons library created/linked
- [ ] Component library in Figma
- [ ] All screens designed
- [ ] Responsive variants shown
- [ ] Interaction states documented
- [ ] Error states designed
- [ ] Loading states designed
- [ ] Empty states designed
- [ ] Dark mode (optional) designed
- [ ] Accessibility specs noted (contrast, text sizes)
- [ ] Animation specs documented (if any)
- [ ] Design tokens exported/organized

---

## 📝 Next Steps for Design Team

1. **Create Figma Project**
   - Import this spec
   - Create color library (auto-components)
   - Create typography styles
   - Create component library

2. **Design Screens** (Priority order)
   - Main ask screen (most critical)
   - Answer display screen
   - Clarification dialog
   - Admin dashboard
   - Upload form

3. **Document Interactions**
   - Button hover/active states
   - Form validation states
   - Loading animations
   - Error handling UI
   - Success confirmations

4. **Prepare for Handoff**
   - Export design tokens
   - Create design system guide
   - Document all interactions
   - Provide Figma link to developers
   - Create spec document for each screen

---

## 📞 Questions for Product Team

1. **Branding:** Should we follow existing company branding or create new brand?
2. **Dark Mode:** Required or nice-to-have?
3. **Animations:** Micro-interactions desired? (e.g., answer fade-in)
4. **Mobile Priority:** Is mobile-first or desktop-first approach?
5. **Admin Features:** How many admin features needed vs. basic customer interface?
6. **Accessibility:** WCAG AA or AAA level required?
7. **Languages:** English only or multi-language support?
8. **Integrations:** Embed in existing app or standalone web app?

---

## 📚 Reference Materials

- **API Docs:** See [API.md](./API.md) in repository
- **Quick Start:** See [API-QUICKSTART.md](./API-QUICKSTART.md)
- **Architecture:** See [docs/architecture/](./docs/architecture/)

---

## 🎨 Figma Template Link

(To be filled in when Figma project is created)

`https://www.figma.com/file/[PROJECT-ID]/PolicyBuddies-Design`

---

**Document Version:** 1.0  
**Created:** March 7, 2026  
**Last Updated:** March 7, 2026  
**Status:** Ready for Design

---

## Appendix: API Response Examples

### Complete Ask Flow Example

**User asks:** "What is the minimum premium I need to pay?"

**Frontend Request:**
```javascript
const response = await fetch('http://localhost:3000/api/ask', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    question: 'What is the minimum premium I need to pay?',
    topK: 3,
    sessionId: 'session_abc123'
  })
});

const data = await response.json();
```

**Backend Response:**
```json
{
  "success": true,
  "question": "What is the minimum premium I need to pay?",
  "answer": "The minimum premium for Wealth Pro II is $50 per month or $600 per year. This is the baseline premium that covers basic death benefit protection. Additional riders and coverage levels can be added for higher premiums.",
  "confidence": 0.89,
  "sources": [
    {
      "chunk": "minimum premium $50/month or $600/year",
      "score": 0.95,
      "document": "Wealth Pro II - Product Summary v1.0"
    },
    {
      "chunk": "coverage levels start at basic protection",
      "score": 0.87,
      "document": "Wealth Pro II - Product Summary v1.0"
    }
  ],
  "reasoning": {
    "detectedIntent": "pricing_information",
    "clarificationNeeded": false,
    "clarificationQuestions": [],
    "turnCount": 1
  },
  "orchestration": {
    "status": "completed",
    "finalizedAt": "2026-03-07T10:35:12.456Z"
  }
}
```

**Frontend Displays:**
- Badge: "✓ Confidence: 89%"
- Main answer text (rendered as markdown or plain text)
- Source section showing document and relevant chunk
- Buttons: "Ask Follow-up" or "New Question"

---

**End of Design Specification**

This document should provide everything needed to design the UI in Figma!
