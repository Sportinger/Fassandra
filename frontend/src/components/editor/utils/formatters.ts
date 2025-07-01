import * as Y from 'yjs';

// TODO: Define a more robust user color mapping if needed
const userColors = [
  '#6eeb83', // Green
  '#ffbc42', // Orange
  '#ecd444', // Yellow
  '#ee6352', // Red
  '#9ac2c9', // Blue
  '#8acb88', // Light Green
  '#d9a0a5'  // Pink
];
const defaultUserColor = '#cccccc'; // Default color

/**
 * Returns a consistent color for a user based on their user ID.
 * @param {string} [userId] - The user's ID.
 * @returns {string} - A color hex code.
 */
export const getUserColor = (userId?: string): string => {
  if (!userId) return defaultUserColor;
  // Simple hash function to get a consistent index
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash % userColors.length);
  return userColors[index];
};

/**
 * Checks if the Yjs document is empty.
 * @param {Y.Doc} ydoc - The Yjs document.
 * @returns {boolean} - True if empty, false otherwise.
 */
export const isYDocEmpty = (ydoc: Y.Doc): boolean => {
  const contentXml = ydoc.getXmlFragment('default');
  return contentXml.length === 0;
};

/**
 * Helper function to format parsed content elements into display text
 */
export const formatContentElement = (blockType: string, contentJsonString: string): string => {
  try {
    // For 'paragraph', contentJsonString is expected to be a JSON-encoded string,
    // e.g., "\"Hallo Welt\"" which parses to "Hallo Welt".
    if (blockType === 'paragraph') {
      const actualText = JSON.parse(contentJsonString);
      if (typeof actualText === 'string') {
        return actualText; // Return the raw string, e.g., "Hallo Welt"
      } else {
        // This case should not be hit if backend sends correctly JSON-string-encoded content for paragraphs
        console.warn(`[Editor Format] Expected string content for paragraph after parsing, but got ${typeof actualText}:`, actualText);
        return String(actualText || ''); // Fallback to converting whatever was parsed
      }
    }

    // For other known block types, contentJsonString is a JSON string of an object
    const element = JSON.parse(contentJsonString);
    let formatted = '';
    switch (blockType) {
      case 'dialogue':
        formatted = `${element.speaker || 'Unknown'}: ${element.line || ''}`;
        break;
      case 'monologue':
        formatted = `${element.speaker || 'Unknown'}:\n${(element.lines || []).join('\n')}`;
        break;
      case 'stage_direction':
        formatted = `(${(element.description || element.text || '...')})`;
        break;
      case 'joint_dialogue':
        formatted = `${(element.speakers || []).join('/')}: ${element.line || ''}`;
        break;
      case 'reading':
         formatted = `${element.speaker || 'Reader'}: (Reading) ${element.reading_text || '...'}`;
        break;
      // No 'paragraph' case here; it's handled above.
      case 'unknown':
      default:
        // This default handles truly unknown types.
        console.warn(`[Editor Format] Encountered unknown blockType '${blockType}' or unhandled structure. Content:`, element);
        formatted = `(${blockType}: ${JSON.stringify(element).substring(0, 100)}...)`; // Increased substring for more context
        break;
    }
    return formatted;
  } catch (e) {
    console.error(`[Editor Format] Failed to parse or format block content for type '${blockType}':`, contentJsonString, e);
    // If JSON.parse fails for a paragraph, it might be that contentJsonString is already the raw text (e.g., from older data or a different source).
    if (blockType === 'paragraph') {
        console.warn(`[Editor Format] Failed to parse paragraph content as JSON, attempting to use as raw text:`, contentJsonString);
        return contentJsonString; // Use the string directly as a fallback
    }
    return `(${blockType}: Error parsing content - see console)`;
  }
};

/**
 * Converts a Map to a plain object for logging.
 * @param {Map<any, any>} map - The map to convert.
 * @returns {Object} - The resulting object.
 */
export const mapToObject = (map: Map<any, any>) => {
  const obj: { [key: string]: any } = {};
  map.forEach((value, key) => {
    obj[key] = value;
  });
  return obj;
}; 