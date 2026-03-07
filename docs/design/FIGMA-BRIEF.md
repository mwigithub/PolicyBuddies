# PolicyBuddies Figma Design Brief

**For:** Design Team  
**Date:** March 7, 2026  
**Status:** Ready for Figma  

---

## 🎯 Project Overview

**PolicyBuddies** is an AI-powered **insurance Q&A assistant** for web.

### What Users Need
- ✅ Ask insurance questions in natural language
- ✅ Get AI-powered answers with confidence scores
- ✅ See source documents for verification
- ✅ Ask follow-up questions for clarification
- ✅ (Admin) Upload and manage policy documents

---

## 👥 3 User Personas

### 1. Sarah (Customer)
- **Goal:** Understand her insurance policy
- **Tech Level:** Medium
- **Frequency:** Few times per month
- **Pain:** Policies are too complex

### 2. Mike (Customer Service Agent)
- **Goal:** Answer customer questions while on call
- **Tech Level:** Medium-High
- **Frequency:** Daily, multiple times
- **Pain:** Manual document search takes too long

### 3. Admin (Document Manager)
- **Goal:** Keep policies up-to-date
- **Tech Level:** High
- **Frequency:** Weekly
- **Pain:** Managing multiple policy versions

---

## 🎨 Design System

### Colors (Use as Figma library)
```
Primary:     #0066CC   (Main actions, buttons)
Success:     #00AA44   (Confirmations, success)
Warning:     #FF9900   (Alerts, warnings)
Error:       #CC0000   (Errors, destructive)
Info:        #0099FF   (Information, scores)
Neutral:     #333333   (Text content)
Light:       #F5F5F5   (Backgrounds, cards)
Border:      #CCCCCC   (Lines, dividers)
```

### Typography (Create text styles)
```
H1: 32px, Bold      (Page titles)
H2: 24px, Bold      (Section headers)
H3: 18px, Semibold  (Component titles)
Body: 14px, Regular (Main content)
Small: 12px, Regular (Labels, hints)
Code: 12px, Monospace (API examples)
```

### Spacing System
```
XS: 4px
S: 8px
M: 16px
L: 24px
XL: 32px
XXL: 48px
```

### Breakpoints
```
Mobile: < 768px
Tablet: 768px - 1024px
Desktop: > 1024px
```

---

## 📱 5 Main Screens to Design

### Screen 1: Main Question Screen
**Purpose:** User asks a question  
**Key Elements:**
- Header with product selector
- Large input field
- Ask button (primary)
- Recent questions list

**States:**
- Default (empty)
- Focused (on input)
- Loading (submitting)

---

### Screen 2: Answer Display Screen
**Purpose:** Show answer with source  
**Key Elements:**
- Back button
- Original question
- Confidence badge (92%)
- Answer text
- Source document card
- Action buttons (Ask follow-up, New question)

**States:**
- Default
- Expanded (full answer)
- Loading
- Error

---

### Screen 3: Clarification Dialog
**Purpose:** Ask for more info if ambiguous  
**Key Elements:**
- Dialog title
- Question text
- Multiple choice options (radio buttons)
- Cancel & Confirm buttons

**States:**
- Default
- Option selected
- Submitting

---

### Screen 4: Admin Dashboard
**Purpose:** Manage documents  
**Key Elements:**
- Document list/cards
- Upload button
- Action buttons (View, Delete, Reindex)
- Stats panel

**States:**
- Empty (no documents)
- Populated
- Loading
- Uploading

---

### Screen 5: Document Upload Form
**Purpose:** Ingest new policy  
**Key Elements:**
- File selector
- Product dropdown
- Jurisdiction dropdown
- Version input
- Document type dropdown
- Progress bar (during upload)

**States:**
- Empty form
- File selected
- Submitting
- Complete
- Error

---

## 🧩 Component Inventory

### Input Components
- ✅ Text input (single line)
- ✅ Text area (multi-line)
- ✅ Dropdown/Select
- ✅ Radio buttons
- ✅ Checkbox
- ✅ Search input

### Button Components
- ✅ Primary button (Ask, Submit)
- ✅ Secondary button (Cancel)
- ✅ Tertiary button (View, Delete)
- ✅ Icon button (Menu, Settings)

### Display Components
- ✅ Card (document, question)
- ✅ Badge (confidence score, tags)
- ✅ Message/Alert box
- ✅ Modal/Dialog
- ✅ Progress indicator

### Layout Components
- ✅ Header/Navigation
- ✅ Footer
- ✅ Sidebar (optional)

---

## 📐 Layout Grid

**Recommended:** 12-column grid, 16px gutters

```
Mobile  (320px):  1 column
Tablet  (768px):  2 columns
Desktop (1024px): 12 columns
```

---

## 🎭 Interactive States

Design these for EVERY component:

- **Default:** Normal state
- **Hover:** When mouse over
- **Active:** When selected/pressed
- **Focused:** When keyboard focused
- **Disabled:** When not interactive
- **Loading:** During processing
- **Error:** When something fails
- **Success:** When action completes

---

## 🖼️ Wireframe Templates

### Main Screen Layout
```
┌─────────────────────────────────────┐
│ Header: Product selector, Menu      │ (h: 64px)
├─────────────────────────────────────┤
│                                     │
│        Welcome / Main Content       │ (h: variable)
│                                     │
│  [Input Field]                      │
│  [Ask Button]                       │
│                                     │
├─────────────────────────────────────┤
│ Recent Questions / History          │ (h: variable)
└─────────────────────────────────────┘
```

### Answer Screen Layout
```
┌─────────────────────────────────────┐
│ ← Back | Question                   │ (h: 56px)
├─────────────────────────────────────┤
│ ✓ Confidence: 92%                   │
│                                     │
│ Answer Text                         │ (h: variable)
│ (Readable, formatted)               │
│                                     │
├─────────────────────────────────────┤
│ 📄 Source: Document Name            │ (h: 80px)
│ "Source snippet text..."            │
├─────────────────────────────────────┤
│ [Ask Follow-up]  [New Question]     │ (h: 48px)
└─────────────────────────────────────┘
```

---

## 🔤 Content Guidelines

### Tone
- **Professional** (insurance context)
- **Helpful** (guide users)
- **Clear** (avoid jargon)
- **Concise** (short labels)

### Button Labels
- "Ask Question" (not "Submit")
- "Ask Follow-up" (not "Continue")
- "Confirm" (not "OK")
- "Cancel" (clear cancellation)

### Error Messages
- Be specific ("Email format invalid")
- Suggest fix ("Enter email like: name@example.com")
- Be kind (avoid "Error!")

---

## 📱 Mobile Considerations

### Desktop (1024px+)
- Two-column layout (optional sidebar)
- Full component visibility
- Hover states visible

### Tablet (768px - 1024px)
- Single column
- Buttons full width
- Touch-friendly sizing (44px min height)

### Mobile (< 768px)
- Full width
- Large touch targets
- Stacked layout
- Simplified navigation

---

## ♿ Accessibility Requirements

- **Color Contrast:** WCAG AA minimum (#0066CC on white ≈ 4.5:1)
- **Text Sizing:** Min 14px for body text
- **Touch Targets:** Min 44x44px
- **Focus Indicators:** Clear keyboard focus states
- **Alt Text:** All images labeled
- **Semantic HTML:** Proper heading hierarchy

---

## 🎬 Interaction Patterns

### Question Submission
```
User types → Focus on input
User clicks Ask → Show loading state
API processes → Show answer with animation (optional fade-in)
Success → Display answer, enable follow-up
```

### Document Upload
```
User clicks Upload → File selector opens
User selects file → Fill form with defaults
User enters metadata → Validate on blur
User clicks Upload → Show progress bar
Processing → Show "Chunking...", "Generating vectors..."
Complete → Show success message, offer upload another
```

### Clarification Flow
```
User asks ambiguous question → Show dialog immediately
User selects option → Update selection
User clicks Confirm → Continue with context
System gets answer → Show answer screen
```

---

## 📊 Design Tokens (Export from Figma)

Create these as variables/tokens:

```javascript
// Colors
--color-primary: #0066CC
--color-success: #00AA44
--color-warning: #FF9900
--color-error: #CC0000
--color-info: #0099FF
--color-text: #333333
--color-bg: #FFFFFF
--color-bg-light: #F5F5F5
--color-border: #CCCCCC

// Spacing
--space-xs: 4px
--space-s: 8px
--space-m: 16px
--space-l: 24px
--space-xl: 32px
--space-xxl: 48px

// Typography
--font-size-h1: 32px
--font-size-body: 14px
--font-size-small: 12px

// Border Radius
--radius-sm: 4px
--radius-md: 8px
--radius-lg: 16px
```

---

## ✅ Figma Setup Checklist

- [ ] Create project: "PolicyBuddies"
- [ ] Set up 12-column grid (16px gutters)
- [ ] Create color library (8 colors)
- [ ] Create typography styles (6 sizes)
- [ ] Create spacing system
- [ ] Build component library:
  - [ ] Button (primary, secondary, tertiary, icon)
  - [ ] Input (text, dropdown, radio, checkbox)
  - [ ] Card
  - [ ] Badge
  - [ ] Dialog
- [ ] Design 5 main screens
- [ ] Create responsive variants (mobile, tablet, desktop)
- [ ] Document interaction states
- [ ] Export design tokens
- [ ] Share with developers

---

## 🔗 Links for Reference

- **Full Design Spec:** [docs/design/DESIGN-SPEC.md](../DESIGN-SPEC.md)
- **API Documentation:** [docs/api/](../../api/)
- **Data Models:** [docs/design/DESIGN-SPEC.md#data-models](../DESIGN-SPEC.md#-%data-models)

---

## 📞 Questions to Answer

1. **Branding:** Use existing company branding or create new?
2. **Dark Mode:** Required or nice-to-have?
3. **Animations:** Micro-interactions desired?
4. **Logo/Icon:** Provide brand assets or design from scratch?
5. **Localization:** English only or multi-language?

---

## 🚀 Next Steps

1. **Copy colors & typography** → Create Figma library
2. **Design screens** → Follow wireframes above
3. **Create components** → Build reusable component library
4. **Document interactions** → Specify all state changes
5. **Create variants** → Mobile, tablet, desktop
6. **Handoff to dev** → Export design tokens + specs

---

**Now Ready for Figma!** 🎨

**Cut & Paste This Brief into Your Figma File** for quick reference while designing.

Last Updated: March 7, 2026
