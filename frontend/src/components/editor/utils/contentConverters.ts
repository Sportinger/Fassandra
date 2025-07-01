import { formatContentElement } from './formatters';

/**
 * Convert blocks to TipTap content format
 */
export const convertBlocksToTiptapContent = (blocks: any[]) => {
  if (!blocks || blocks.length === 0) {
    return '<p></p>'; // Default empty paragraph
  }

  return blocks.map(block => {
    const formattedText = formatContentElement(block.block_type, block.content);
    return `<p>${formattedText}</p>`;
  }).join('');
};

/**
 * Extract speaker names from editor HTML content
 */
export const extractSpeakerNames = (html: string): Set<string> => {
  const extractedNames = new Set<string>();
  
  // Parse HTML and extract speaker names
  const doc = new DOMParser().parseFromString(html, 'text/html');
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