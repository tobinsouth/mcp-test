# React Components

Reusable React components for the web platform.

## Directory Structure

```
components/
├── config/               # Configuration editing
│   ├── ConfigEditor.tsx      # JSON editor with validation
│   ├── AuthConfigForm.tsx    # Auth type selector
│   └── PhaseConfigForm.tsx   # Phase toggles
│
├── results/              # Result display
│   ├── CheckList.tsx         # Real-time check list
│   ├── PhaseResult.tsx       # Phase summary
│   └── ReportSummary.tsx     # Overall summary
│
├── transcript/           # Transcript viewing
│   └── TranscriptViewer.tsx  # Message timeline
│
└── layout/               # Layout components
    ├── Header.tsx
    └── Sidebar.tsx
```

## Component Guidelines

### Server vs Client Components

**Server Components** (default):
- Data fetching
- Static content
- No client-side interactivity

**Client Components** (`'use client'`):
- Event handlers
- useState/useEffect
- Browser APIs

### Naming Conventions

- PascalCase for component files
- One component per file
- Co-locate styles and tests

## Key Components

### ConfigEditor
Monaco-based JSON editor with:
- Schema validation
- Syntax highlighting
- Error markers

```tsx
<ConfigEditor
  value={config}
  onChange={setConfig}
  schema={TestConfigSchema}
/>
```

### CheckList
Real-time check display:

```tsx
<CheckList
  checks={checks}
  streaming={isRunning}
/>
```

### TranscriptViewer
Interaction timeline:

```tsx
<TranscriptViewer
  transcript={transcript}
  expandToolCalls={true}
/>
```

## Styling

Components use:
- Tailwind CSS for utility classes
- CSS Modules for component-specific styles
- CSS variables for theming
