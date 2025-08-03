import { formatContentElement } from './formatters';

/**
 * Convert blocks to TipTap content format with proper dialogue block structure
 */
export const convertBlocksToTiptapContent = (blocks: any[]) => {
  console.log('[Content Converter] Converting blocks:', blocks);
  
  if (!blocks || blocks.length === 0) {
    console.log('[Content Converter] No blocks provided, returning empty paragraph');
    return '<p></p>'; // Default empty paragraph
  }

  let currentPageNumber = 0;
  const convertedContent = blocks.map((block, index) => {
    console.log(`[Content Converter] Processing block ${index}:`, { 
      blockType: block.block_type, 
      contentLength: block.content?.length,
      content: block.content?.substring(0, 100) + '...',
      pageNumber: block.page_number
    });

    let result = '';
    
    // Check if we need to insert a page indicator
    if (block.page_number && block.page_number !== currentPageNumber) {
      currentPageNumber = block.page_number;
      // Insert page indicator before this content
      result += `<div data-type="page-indicator" data-page-number="${currentPageNumber}" class="page-indicator">
        <span class="page-label" contenteditable="false">SEITE ${currentPageNumber}</span>
      </div>`;
      console.log(`[Content Converter] Inserting page indicator for page ${currentPageNumber}`);
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
          try {
            // Parse the JSON content
            const element = JSON.parse(contentJsonString);
            console.log(`[Content Converter] Parsed ${blockType} element:`, element);
            
            // Extract speaker(s) and text
            let speakerName = '';
            let dialogueText = '';
            
            if (blockType === 'dialogue') {
              speakerName = element.speaker || 'Unknown Speaker';
              dialogueText = element.line || '';
            } else if (blockType === 'monologue') {
              speakerName = element.speaker || 'Unknown Speaker';
              // 🔧 FIX: Check both new and old field structures
              dialogueText = element.line || (element.lines && Array.isArray(element.lines) ? element.lines.join('\n') : '') || '';
            } else if (blockType === 'joint_dialogue') {
              // 🔧 FIX: Check both new and old field structures for speakers
              if (element.speaker && typeof element.speaker === 'string') {
                // New format: single speaker string with multiple names separated by newlines
                speakerName = element.speaker.split('\n').filter((s: string) => s.trim()).join('/');
              } else if (element.speakers && Array.isArray(element.speakers)) {
                // Old format: array of speaker names
                speakerName = element.speakers.join('/');
              } else {
                speakerName = 'Multiple Speakers';
              }
              dialogueText = element.line || '';
            } else if (blockType === 'reading') {
              speakerName = element.speaker || 'Reader';
              // 🔧 FIX: Check multiple possible text fields
              const readingText = element.reading_text || element.line || element.description || '';
              dialogueText = readingText ? `(Reading) ${readingText}` : '(Reading)';
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
            result += dialogueHTML;
            return result;
          } catch (parseError) {
            console.error(`[Content Converter] Failed to parse ${blockType} JSON, falling back to text:`, contentJsonString, parseError);
            // Fallback: treat as plain text dialogue
            const fallbackText = contentJsonString.substring(0, 200) + (contentJsonString.length > 200 ? '...' : '');
            result += `<div data-type="dialogue-block" data-layout="default">
              <div data-type="speaker">Unknown Speaker</div>
              <div data-type="dialogue-text">
                <p>${fallbackText}</p>
              </div>
            </div>`;
            return result;
          }
        }
        
        case 'scene-block': {
          try {
            // Use scene_number and scene_title from the block object, not from JSON content
            const sceneNumber = block.scene_number || '1';
            const sceneTitle = block.scene_title || 'Untitled Scene';
            console.log(`[Content Converter] Creating scene block - Number: "${sceneNumber}", Title: "${sceneTitle}" from block fields`);
            
            // Create proper scene block HTML with both data attributes for the extension
            const sceneHTML = `<div data-type="scene-block" data-scene-number="${sceneNumber}" data-scene-name="${sceneTitle}">
              <span class="scene-number" contenteditable="false">${sceneNumber}</span>
              <span class="scene-separator" contenteditable="false"> </span>
              <span class="scene-name" contenteditable="true">${sceneTitle}</span>
            </div>`;
            
            console.log(`[Content Converter] Generated scene HTML:`, sceneHTML);
            result += sceneHTML;
            return result;
          } catch (parseError) {
            console.error(`[Content Converter] Failed to create scene-block, falling back to text:`, parseError);
            // Fallback: treat as plain text
            result += `<p><strong>Scene: ${block.scene_number || ''} ${block.scene_title || contentJsonString}</strong></p>`;
            return result;
          }
        }
        
        case 'stage_direction': {
          try {
            // Parse the JSON content
            const element = JSON.parse(contentJsonString);
            const description = element.description || element.text || '';
            console.log(`[Content Converter] Creating stage direction: "${description}"`);
            
            // Create paragraph for stage direction
            result += `<p><em>(${description})</em></p>`;
            return result;
          } catch (parseError) {
            console.error(`[Content Converter] Failed to parse stage_direction JSON, falling back to text:`, contentJsonString, parseError);
            // Fallback: treat as plain text stage direction
            result += `<p><em>(${contentJsonString})</em></p>`;
            return result;
          }
        }
        
        case 'paragraph': {
          // Handle paragraph blocks - could be JSON string or plain text
          try {
            const actualText = JSON.parse(contentJsonString);
            console.log(`[Content Converter] Creating paragraph from JSON: "${actualText}"`);
            if (typeof actualText === 'string') {
              result += `<p>${actualText}</p>`;
              return result;
            } else {
              result += `<p>${String(actualText || '')}</p>`;
              return result;
            }
          } catch (e) {
            // If JSON parsing fails, treat as plain text
            console.log(`[Content Converter] Creating paragraph from plain text: "${contentJsonString}"`);
            result += `<p>${contentJsonString}</p>`;
            return result;
          }
        }
        
        case 'cue-block':
        case 'cue': {
          try {
            // Parse the JSON content for cue blocks
            const element = JSON.parse(contentJsonString);
            const cueType = element.cueType || element.type || 'light';
            const cueNumber = element.cueNumber || element.number || '';
            const cueContent = element.content || element.text || '';
            
            console.log(`[Content Converter] Creating cue block - Type: "${cueType}", Number: "${cueNumber}", Content: "${cueContent}"`);
            
            // Create proper cue block HTML that matches the extension's structure
            const cueHTML = `<div data-type="cue-block" data-cue-type="${cueType}" data-cue-number="${cueNumber}">${cueContent}</div>`;
            
            console.log(`[Content Converter] Generated cue HTML:`, cueHTML);
            result += cueHTML;
            return result;
          } catch (parseError) {
            console.error(`[Content Converter] Failed to parse cue block JSON, skipping:`, contentJsonString, parseError);
            // Skip malformed cue blocks
            return result;
          }
        }
        
        case 'content': {
          // Handle content blocks (raw HTML from content snapshots)
          console.log(`[Content Converter] Processing content block with raw HTML: "${contentJsonString}"`);
          // Content blocks contain raw HTML, don't try to parse as JSON
          // Clean up any duplicate cue UI elements that might have been saved
          let cleanedContent = contentJsonString;
          
          // Remove duplicate cue UI elements that shouldn't be in the saved content
          cleanedContent = cleanedContent.replace(/<div[^>]*class="cue-connection-drag-area"[^>]*>[\s\S]*?<\/div>/g, '');
          cleanedContent = cleanedContent.replace(/<div[^>]*class="cue-move-drag-area"[^>]*>[\s\S]*?<\/div>/g, '');
          cleanedContent = cleanedContent.replace(/<span[^>]*class="drag-handle"[^>]*>⋮⋮<\/span>/g, '');
          cleanedContent = cleanedContent.replace(/<span[^>]*class="cue-label"[^>]*>[^<]*:<\/span>/g, '');
          cleanedContent = cleanedContent.replace(/<span[^>]*class="cue-number"[^>]*>Q\d*<\/span>/g, '');
          
          result += cleanedContent;
          return result;
        }
        
        default: {
          console.log(`[Content Converter] Unknown block type "${blockType}", using fallback formatting`);
          // For unknown block types, use the original formatting
          const formattedText = formatContentElement(blockType, contentJsonString);
          result += `<p>${formattedText}</p>`;
          return result;
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