// 🔧 NEW: Page Break Service - Accurately positions page breaks based on database and DOM data
import type { Editor } from '@tiptap/react';

export interface BlockData {
  block_id: string;
  page_number: number;
  content_preview: string;
  block_type: string;
}

export interface PageBreakPosition {
  pageNumber: number;
  position: number; // pixels from top
  blockBefore?: string; // ID of last block on previous page
  blockAfter?: string; // ID of first block on this page
  isAccurate: boolean; // whether position is based on actual DOM or estimated
}

/**
 * Service to manage page break positioning based on actual block data and DOM positions
 */
export class PageBreakService {
  private editor: Editor | null = null;
  private blocksData: BlockData[] = [];
  private lastCalculatedPositions: PageBreakPosition[] = [];

  constructor(editor: Editor | null = null) {
    this.editor = editor;
  }

  /**
   * Set the current editor instance
   */
  setEditor(editor: Editor | null) {
    this.editor = editor;
  }

  /**
   * Update the blocks data from database
   */
  setBlocksData(blocks: BlockData[]) {
    this.blocksData = blocks.sort((a, b) => a.page_number - b.page_number);
    console.log(`📊 PageBreakService: Updated with ${blocks.length} blocks across ${this.getPageCount()} pages`);
  }

  /**
   * Get unique page numbers from blocks data
   */
  getPageNumbers(): number[] {
    return [...new Set(this.blocksData.map(b => b.page_number))].sort((a, b) => a - b);
  }

  /**
   * Get total page count
   */
  getPageCount(): number {
    const pageNumbers = this.getPageNumbers();
    return pageNumbers.length > 0 ? Math.max(...pageNumbers) : 1;
  }

  /**
   * Find DOM elements for blocks in the editor
   */
  private findBlockElements() {
    if (!this.editor?.view?.dom) return [];

    const editorElement = this.editor.view.dom;
    const editorRect = editorElement.getBoundingClientRect();
    const elements: Array<{
      blockId: string;
      pageNumber: number;
      element: HTMLElement;
      top: number;
      bottom: number;
      height: number;
    }> = [];

    // Find all potential block elements
    const candidates = editorElement.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6, blockquote, [data-block-id]');

    Array.from(candidates).forEach((element, index) => {
      const htmlElement = element as HTMLElement;
      const rect = htmlElement.getBoundingClientRect();

      // Skip if element has no content or is too small
      if (rect.height < 10 || (!htmlElement.textContent?.trim() && !htmlElement.querySelector('img, video'))) {
        return;
      }

      // Calculate position relative to editor
      const top = rect.top - editorRect.top + editorElement.scrollTop;
      const bottom = rect.bottom - editorRect.top + editorElement.scrollTop;

      // Try to match with database blocks by content
      const blockData = this.findMatchingBlock(htmlElement);
      const blockId = htmlElement.getAttribute('data-block-id') || blockData?.block_id || `dom-block-${index}`;
      const pageNumber = blockData?.page_number || this.estimatePageNumber(top);

      elements.push({
        blockId,
        pageNumber,
        element: htmlElement,
        top,
        bottom,
        height: rect.height
      });
    });

    return elements.sort((a, b) => a.top - b.top);
  }

  /**
   * Try to match DOM element with database block by content
   */
  private findMatchingBlock(element: HTMLElement): BlockData | null {
    const textContent = element.textContent?.trim();
    if (!textContent || textContent.length < 10) return null;

    // Find block with matching content (first 100 characters)
    const contentStart = textContent.substring(0, 100);
    return this.blocksData.find(block => 
      block.content_preview && 
      block.content_preview.includes(contentStart.substring(0, 50))
    ) || null;
  }

  /**
   * Estimate page number based on position (fallback)
   */
  private estimatePageNumber(topPosition: number): number {
    // Assume ~600px per page as fallback
    return Math.floor(topPosition / 600) + 1;
  }

  /**
   * Calculate accurate page break positions
   */
  calculatePageBreakPositions(): PageBreakPosition[] {
    const pageNumbers = this.getPageNumbers();
    const positions: PageBreakPosition[] = [];

    if (pageNumbers.length <= 1) {
      console.log('📄 PageBreakService: Only one page, no breaks needed');
      return [];
    }

    // Try to get DOM-based positions first
    const domElements = this.findBlockElements();
    const hasDomData = domElements.length > 0;

    console.log(`📄 PageBreakService: Calculating breaks for pages ${pageNumbers.join(', ')} (DOM elements: ${domElements.length})`);

    for (let i = 1; i < pageNumbers.length; i++) {
      const currentPageNum = pageNumbers[i];
      const previousPageNum = pageNumbers[i - 1];

      let position: number;
      let blockBefore: string | undefined;
      let blockAfter: string | undefined;
      let isAccurate = false;

      if (hasDomData) {
        // Find DOM-based position
        const previousPageElements = domElements.filter(el => el.pageNumber === previousPageNum);
        const currentPageElements = domElements.filter(el => el.pageNumber === currentPageNum);

        if (previousPageElements.length > 0 && currentPageElements.length > 0) {
          const lastPrevious = previousPageElements[previousPageElements.length - 1];
          const firstCurrent = currentPageElements[0];

          // Position break between the blocks
          position = (lastPrevious.bottom + firstCurrent.top) / 2;
          blockBefore = lastPrevious.blockId;
          blockAfter = firstCurrent.blockId;
          isAccurate = true;

          console.log(`📍 Page ${currentPageNum} break: ${position}px (between ${blockBefore} and ${blockAfter})`);
        } else {
          // Fallback to estimated position
          position = this.estimatePageBreakPosition(currentPageNum, previousPageNum);
          console.log(`📍 Page ${currentPageNum} break: ${position}px (estimated - missing DOM elements)`);
        }
      } else {
        // Fallback to database-based estimation
        position = this.estimatePageBreakPosition(currentPageNum, previousPageNum);
        console.log(`📍 Page ${currentPageNum} break: ${position}px (estimated - no DOM data)`);
      }

      positions.push({
        pageNumber: currentPageNum,
        position,
        blockBefore,
        blockAfter,
        isAccurate
      });
    }

    this.lastCalculatedPositions = positions;
    return positions;
  }

  /**
   * Estimate page break position based on block data
   */
  private estimatePageBreakPosition(currentPageNum: number, previousPageNum: number): number {
    const previousPageBlocks = this.blocksData.filter(b => b.page_number === previousPageNum);
    const currentPageBlocks = this.blocksData.filter(b => b.page_number === currentPageNum);

    // Calculate based on content length
    let estimatedPosition = (currentPageNum - 1) * 600; // Default 600px per page

    if (previousPageBlocks.length > 0) {
      // Use block count and content length for better estimation
      const avgBlockHeight = 80; // Estimated average block height
      const previousPageHeight = previousPageBlocks.length * avgBlockHeight;
      
      // Add some spacing between pages
      estimatedPosition = (previousPageNum - 1) * 600 + previousPageHeight + 20;
    }

    return Math.max(50, estimatedPosition); // Minimum 50px from top
  }

  /**
   * Get the last calculated positions
   */
  getLastCalculatedPositions(): PageBreakPosition[] {
    return this.lastCalculatedPositions;
  }

  /**
   * Check if a position update would be significant enough to trigger a change
   */
  isSignificantPositionChange(pageNumber: number, newPosition: number): boolean {
    const existing = this.lastCalculatedPositions.find(p => p.pageNumber === pageNumber);
    if (!existing) return true;

    return Math.abs(existing.position - newPosition) > 10; // 10px threshold
  }

  /**
   * Update a specific page break position (from manual dragging)
   */
  updatePageBreakPosition(pageNumber: number, newPosition: number): void {
    const index = this.lastCalculatedPositions.findIndex(p => p.pageNumber === pageNumber);
    if (index >= 0) {
      this.lastCalculatedPositions[index] = {
        ...this.lastCalculatedPositions[index],
        position: newPosition,
        isAccurate: false // Manual positioning
      };
      console.log(`📍 Updated page ${pageNumber} break position to ${newPosition}px (manual)`);
    }
  }

  /**
   * Auto-recalculate positions when content changes
   */
  recalculatePositions(): void {
    if (this.blocksData.length === 0) {
      console.log('📄 PageBreakService: No blocks data available for recalculation');
      return;
    }

    const newPositions = this.calculatePageBreakPositions();
    console.log(`📄 PageBreakService: Recalculated ${newPositions.length} page break positions`);
  }

  /**
   * Get debug information about current state
   */
  getDebugInfo(): {
    blocksCount: number;
    pageCount: number;
    domElementsCount: number;
    breakPositions: PageBreakPosition[];
  } {
    const domElements = this.findBlockElements();
    
    return {
      blocksCount: this.blocksData.length,
      pageCount: this.getPageCount(),
      domElementsCount: domElements.length,
      breakPositions: this.lastCalculatedPositions
    };
  }
} 