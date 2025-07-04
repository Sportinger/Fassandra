import { formatContentElement } from './formatters';

/**
 * Convert blocks to TipTap content format with proper dialogue block structure
 */
export const convertBlocksToTiptapContent = (blocks: any[]) => {
  console.log('[Content Converter] Converting blocks:', blocks);
  
  // Chrome-specific debugging - declare once and reuse
  const isChrome = /Chrome/.test(navigator.userAgent) && !/Edg/.test(navigator.userAgent);
  if (isChrome) {
    console.log('[Chrome Debug] Converting blocks in Chrome, block count:', blocks.length);
  }
  
  if (!blocks || blocks.length === 0) {
    console.log('[Content Converter] No blocks provided, returning empty paragraph');
    return '<p></p>'; // Default empty paragraph
  }

  const convertedContent = blocks.map((block, index) => {
    console.log(`[Content Converter] Processing block ${index}:`, { 
      blockType: block.block_type, 
      contentLength: block.content?.length,
      content: block.content?.substring(0, 100) + '...' 
    });
    
    if (isChrome) {
      console.log(`[Chrome Debug] Processing block ${index} in Chrome:`, {
        blockType: block.block_type,
        contentPreview: block.content?.substring(0, 50) + '...'
      });
    }
    
    const blockType = block.block_type;
    const contentJsonString = block.content;
    
    try {
      // Handle different block types and convert them to proper TipTap HTML
      switch (blockType) {
        case 'dialogue':
        case 'monologue':
        case 'joint_dialogue':
        case 'reading': {
          // Parse the JSON content
          const element = JSON.parse(contentJsonString);
          console.log(`[Content Converter] Parsed ${blockType} element:`, element);
          
          // Extract speaker(s) and text
          let speakerName = '';
          let dialogueText = '';
          
          if (blockType === 'dialogue') {
            speakerName = element.speaker || 'Unknown';
            dialogueText = element.line || '';
          } else if (blockType === 'monologue') {
            speakerName = element.speaker || 'Unknown';
            dialogueText = (element.lines || []).join('\n');
          } else if (blockType === 'joint_dialogue') {
            speakerName = (element.speakers || []).join('/');
            dialogueText = element.line || '';
          } else if (blockType === 'reading') {
            speakerName = element.speaker || 'Reader';
            dialogueText = `(Reading) ${element.reading_text || ''}`;
          }
          
          console.log(`[Content Converter] Creating dialogue block - Speaker: "${speakerName}", Text: "${dialogueText}"`);
          
          // Create proper dialogue block HTML
          const dialogueHTML = `<div data-type="dialogue-block" data-layout="default">
            <div data-type="speaker">${speakerName}</div>
            <div data-type="dialogue-text">
              <p>${dialogueText}</p>
            </div>
          </div>`;
          
          console.log(`[Content Converter] Generated dialogue HTML:`, dialogueHTML);
          return dialogueHTML;
        }
        
        case 'stage_direction': {
          // Parse the JSON content
          const element = JSON.parse(contentJsonString);
          const description = element.description || element.text || '';
          console.log(`[Content Converter] Creating stage direction: "${description}"`);
          
          // Create paragraph for stage direction
          return `<p><em>(${description})</em></p>`;
        }
        
        case 'paragraph': {
          // Handle paragraph blocks
          const actualText = JSON.parse(contentJsonString);
          console.log(`[Content Converter] Creating paragraph: "${actualText}"`);
          if (typeof actualText === 'string') {
            return `<p>${actualText}</p>`;
          } else {
            return `<p>${String(actualText || '')}</p>`;
          }
        }
        
        default: {
          console.log(`[Content Converter] Unknown block type "${blockType}", using fallback formatting`);
          // For unknown block types, use the original formatting
          const formattedText = formatContentElement(blockType, contentJsonString);
          return `<p>${formattedText}</p>`;
        }
      }
    } catch (e) {
      console.error(`[Content Converter] Failed to convert block of type '${blockType}':`, contentJsonString, e);
      // Fallback to original formatting
      const formattedText = formatContentElement(blockType, contentJsonString);
      return `<p>${formattedText}</p>`;
    }
  });
  
  const finalContent = convertedContent.join('');
  console.log('[Content Converter] Final converted content length:', finalContent.length);
  console.log('[Content Converter] Final converted content preview:', finalContent.substring(0, 500) + '...');
  
  // Chrome-specific debugging for final output - reuse the isChrome variable from top
  if (isChrome) {
    console.log('[Chrome Debug] Final content for Chrome:');
    console.log('[Chrome Debug] - Length:', finalContent.length);
    console.log('[Chrome Debug] - Contains dialogue blocks:', finalContent.includes('data-type="dialogue-block"'));
    console.log('[Chrome Debug] - Contains speaker elements:', finalContent.includes('data-type="speaker"'));
    console.log('[Chrome Debug] - Preview:', finalContent.substring(0, 300) + '...');
    
    // Check for potential HTML structure issues
    const dialogueBlockMatches = finalContent.match(/data-type="dialogue-block"/g);
    const speakerMatches = finalContent.match(/data-type="speaker"/g);
    console.log('[Chrome Debug] - Dialogue block count:', dialogueBlockMatches ? dialogueBlockMatches.length : 0);
    console.log('[Chrome Debug] - Speaker element count:', speakerMatches ? speakerMatches.length : 0);
  }
  
  return finalContent;
};

/**
 * Extract speaker names from editor HTML content
 */
export const extractSpeakerNames = (html: string): Set<string> => {
  const extractedNames = new Set<string>();
  
  // Parse HTML and extract speaker names
  const doc = new DOMParser().parseFromString(html, 'text/html');
  
  // First, look for speaker names in dialogue blocks
  const speakerElements = doc.querySelectorAll('[data-type="speaker"]');
  speakerElements.forEach(element => {
    const speakerName = element.textContent?.trim();
    if (speakerName && speakerName.length > 0) {
      extractedNames.add(speakerName);
    }
  });
  
  // Also look for speaker names in paragraphs for backward compatibility
  const paragraphs = doc.querySelectorAll('p');
  paragraphs.forEach(p => {
    const text = p.textContent || '';
    // Match speaker name patterns: "NAME:" at the beginning of a line
    const match = text.match(/^([A-Z][A-Z\s&.-]+):/);
    if (match) {
      extractedNames.add(match[1].trim());
    }
  });
  
  return extractedNames;
}; 