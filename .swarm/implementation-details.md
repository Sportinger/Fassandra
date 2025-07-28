# Implementation Details: Virtual Page System

## 🎯 Core Concept

Instead of splitting content into separate page containers, we'll use a **single continuous editor** with **virtual page overlays**. This maintains natural text flow while providing visual page boundaries.

## 🏗️ Component Architecture

### 1. **VirtualPageView Component**
Primary container that orchestrates the page system.

```typescript
interface VirtualPageViewProps {
  children: React.ReactNode; // TipTap editor
  pageConfig: {
    size: 'A4' | 'Letter' | 'Legal';
    orientation: 'portrait' | 'landscape';
    margins: { top: number; right: number; bottom: number; left: number };
  };
  showRuler: boolean;
  showPageNumbers: boolean;
  onPageChange?: (pageNumber: number) => void;
}
```

### 2. **PageOverlay System**
Visual representation of pages without affecting content flow.

```typescript
interface PageOverlay {
  pageNumber: number;
  top: number;      // Absolute position in document
  height: number;   // Page height
  isVisible: boolean; // Currently in viewport
  content: {
    startOffset: number; // Character offset where page starts
    endOffset: number;   // Character offset where page ends
  };
}
```

### 3. **ScrollManager**
Handles smooth scrolling and page tracking.

```typescript
class ScrollManager {
  currentPage: number;
  scrollContainer: HTMLElement;
  
  scrollToPage(pageNumber: number): void;
  getPageAtPosition(scrollY: number): number;
  onScroll(callback: (page: number) => void): void;
}
```

## 📏 Text Measurement Strategy

### Approach 1: Line Box Calculation
```typescript
interface LineBox {
  text: string;
  width: number;
  height: number;
  baseline: number;
}

class TextMeasurer {
  measureText(element: HTMLElement): LineBox[];
  calculateBreakPoints(lines: LineBox[], pageHeight: number): number[];
}
```

### Approach 2: Range API
```typescript
class RangeMeasurer {
  // Use browser Range API to measure precise text positions
  getCharacterAtPosition(y: number): number;
  getPositionOfCharacter(index: number): DOMRect;
}
```

## 🎨 CSS Architecture

### Base Styles
```css
.virtual-page-container {
  position: relative;
  background: #f5f5f5;
  overflow-y: auto;
}

.virtual-page-content {
  width: 210mm;
  margin: 0 auto;
  background: white;
  min-height: 297mm;
  padding: 20mm;
  position: relative;
  z-index: 2;
}

.virtual-page-overlay {
  position: absolute;
  pointer-events: none;
  width: 210mm;
  height: 297mm;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1;
}

.page-break-indicator {
  position: absolute;
  width: 100%;
  height: 0;
  border-top: 2px dashed #ccc;
  z-index: 3;
}
```

### Print Styles
```css
@media print {
  .virtual-page-content {
    page-break-after: always;
  }
  
  .virtual-page-overlay,
  .page-break-indicator {
    display: none;
  }
}
```

## 🔄 State Management

```typescript
interface VirtualPageState {
  // Page calculations
  pageCount: number;
  pageHeight: number;
  contentHeight: number;
  
  // Viewport state
  currentPage: number;
  visiblePages: number[];
  scrollPosition: number;
  
  // Content mapping
  pageBreaks: number[]; // Y positions of page breaks
  textOffsets: Map<number, number>; // Page -> character offset
}
```

## 🚀 Performance Optimizations

### 1. **Debounced Calculations**
```typescript
const debouncedRecalculate = debounce(() => {
  calculatePageBreaks();
  updateOverlays();
}, 100);
```

### 2. **Virtual Rendering**
Only render page overlays that are in or near the viewport:
```typescript
const renderablePages = pages.filter(page => {
  const buffer = window.innerHeight;
  return page.top >= scrollY - buffer && 
         page.top <= scrollY + viewportHeight + buffer;
});
```

### 3. **Intersection Observer**
```typescript
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      activatePageFeatures(entry.target);
    }
  });
}, { rootMargin: '50px' });
```

## 🎯 Implementation Steps

### Step 1: Basic Structure
1. Create container component
2. Set up page dimensions
3. Render continuous content

### Step 2: Page Overlays
1. Calculate page positions
2. Render overlay elements
3. Add page numbers

### Step 3: Scroll Handling
1. Track current page
2. Update UI indicators
3. Handle smooth scrolling

### Step 4: Text Measurement
1. Implement line measurement
2. Calculate optimal breaks
3. Avoid orphans/widows

### Step 5: Integration
1. Connect to TipTap
2. Handle content changes
3. Preserve cursor position

## 🧪 Test Cases

1. **Basic Rendering**
   - Pages display at correct size
   - Content flows naturally
   - Margins are respected

2. **Scrolling**
   - Current page updates correctly
   - Smooth scroll to page works
   - Page indicators update

3. **Content Changes**
   - Adding text reflows properly
   - Deleting text updates pages
   - Formatting preserves flow

4. **Edge Cases**
   - Very long paragraphs
   - Images spanning pages
   - Tables and lists

## 🎉 Benefits Over Current Approach

1. **Natural Text Flow**: Content flows continuously
2. **Better Performance**: No DOM manipulation per page
3. **Simpler Architecture**: Single editor instance
4. **Print-Ready**: CSS handles print layout
5. **Responsive**: Adapts to viewport changes

## 🚧 Potential Challenges

1. **Page Break Control**: Need algorithm for optimal breaks
2. **Cursor Navigation**: Must feel natural across pages
3. **Performance**: Large documents need optimization
4. **Print Accuracy**: Must match screen layout

## 📊 Success Criteria

- [ ] Text flows seamlessly between pages
- [ ] < 16ms frame time during scroll
- [ ] Accurate page break positioning
- [ ] Works with all TipTap features
- [ ] Print preview matches display