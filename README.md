# Advanced Data Grid

## 🔗 Live Demo
- **Storybook**: https://storybook-static-peach.vercel.app
- **GitHub**: `[Add your GitHub repo URL here]`

A production-grade, virtualized, and accessible Data Grid component built with React 18, TypeScript, and Tailwind CSS.

## Features

- **Bidirectional Virtualization**: Efficiently renders 50,000+ rows and dozens of columns using manual engine.
- **Sorting**: Multi-column sorting support with deterministic ordering.
- **Column Management**: Resizable, reorderable, and pinnable columns.
- **Visibility Toggles**: Dynamically show/hide columns.
- **Undo Support**: Native undo (Ctrl+Z) for all grid state changes.
- **Editing**: In-cell editing with async validation hooks and loading states.
- **Accessibility**: Full keyboard navigation, ARIA live regions, and screen reader parity.
- **Performance**: Guaranteed 60fps scrolling with layout stabilization.

## Tech Stack

- **Framework**: React 18
- **Language**: TypeScript (Strict Mode)
- **Styling**: Tailwind CSS
- **Build Tool**: Vite
- **Testing**: Vitest + React Testing Library + jest-axe
- **Documentation**: Storybook

## Getting Started

### Installation

```bash
npm install
```

### Running Storybook

To view the components and documentation:

```bash
npm run storybook
```

### Running Tests

```bash
npx vitest run -c vitest.unit.config.ts
```

## Component API

### `DataGrid<T>`

| Prop | Type | Description |
|------|------|-------------|
| `data` | `T[]` | Array of data objects to display. |
| `columns` | `GridColumn<T>[]` | Configuration for columns. |
| `height` | `number` | Height of the grid container (pixels). |
| `onSortChange` | `(config: SortConfig[]) => void` | Callback when sorting changes. |
| `onEdit` | `(rowId, colId, val) => Promise<boolean>` | Async callback for cell edits. |

### `GridColumn<T>`

- `id`: Unique identifier
- `title`: Header title
- `field`: Data key
- `width`: Width in pixels
- `sortable`: Enable sorting
- `editable`: Enable editing
- `pinned`: 'left' | 'right'
- `renderCell`: Custom render function

## Keyboard Navigation

- **Arrow Keys**: Navigate between cells.
- **Enter**: Enter edit mode for a cell.
- **Escape**: Cancel edit mode.
- **Tab**: Standard focus management.

## Project Structure

- `src/components/DataGrid`: Core component source.
- `src/components/DataGrid/hooks`: Custom hooks (e.g., proper virtualization).
- `src/stories`: Storybook stories.
