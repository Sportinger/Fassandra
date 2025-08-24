/**
 * Data Extractor Pattern - Reusable patterns for content extraction, scraping, and validation
 * Handles various data extraction scenarios with robust error handling
 */
class DataExtractorPattern {
  constructor() {
    this.defaultTimeout = 5000;
    this.extractionTimeout = 10000;
  }

  /**
   * Universal data extractor
   * Extracts data from page using flexible selectors and extraction rules
   */
  async extractData(extractionRules, options = {}) {
    const { 
      waitForContent = true,
      validateResults = true,
      retryAttempts = 3 
    } = options;

    let attempt = 0;
    while (attempt < retryAttempts) {
      try {
        if (waitForContent) {
          await this.waitForContentReady(extractionRules);
        }

        const extractedData = await this.performExtraction(extractionRules);

        if (validateResults) {
          await this.validateExtraction(extractedData, extractionRules);
        }

        return { 
          success: true, 
          data: extractedData, 
          timestamp: Date.now(),
          attempts: attempt + 1 
        };
      } catch (error) {
        attempt++;
        if (attempt >= retryAttempts) {
          return { success: false, error: error.message, attempts: attempt };
        }
        await this.waitMs(1000);
      }
    }
  }

  /**
   * Advanced data extraction with multiple strategies
   */
  async performExtraction(rules) {
    const extractionScript = `
      const extractData = (rules) => {
        const results = {};

        // Helper function to get text content safely
        const getTextContent = (element) => {
          if (!element) return null;
          return element.textContent.trim();
        };

        // Helper function to get attribute value
        const getAttribute = (element, attr) => {
          if (!element) return null;
          return element.getAttribute(attr);
        };

        // Helper function to extract using multiple strategies
        const extractByStrategies = (rule) => {
          const strategies = [
            // Direct selector
            () => document.querySelector(rule.selector),
            
            // By text content
            () => rule.text ? Array.from(document.querySelectorAll('*')).find(el => 
              el.textContent && el.textContent.includes(rule.text)
            ) : null,
            
            // By data attributes
            () => rule.dataAttribute ? document.querySelector(\`[data-\${rule.dataAttribute}]\`) : null,
            
            // By class pattern
            () => rule.classPattern ? document.querySelector(\`[class*="\${rule.classPattern}"]\`) : null,
            
            // By ID pattern  
            () => rule.idPattern ? document.querySelector(\`[id*="\${rule.idPattern}"]\`) : null,
            
            // By aria label
            () => rule.ariaLabel ? document.querySelector(\`[aria-label*="\${rule.ariaLabel}"]\`) : null,
            
            // By role
            () => rule.role ? document.querySelector(\`[role="\${rule.role}"]\`) : null
          ];

          for (const strategy of strategies) {
            try {
              const element = strategy();
              if (element) return element;
            } catch (e) {
              // Continue to next strategy
            }
          }
          return null;
        };

        // Process each extraction rule
        for (const [key, rule] of Object.entries(rules)) {
          try {
            if (rule.type === 'list') {
              // Extract array of items
              const elements = rule.selector ? 
                document.querySelectorAll(rule.selector) :
                [];
              
              results[key] = Array.from(elements).map(el => {
                if (rule.itemRules) {
                  // Complex item extraction
                  const item = {};
                  for (const [itemKey, itemRule] of Object.entries(rule.itemRules)) {
                    const childElement = el.querySelector(itemRule.selector);
                    item[itemKey] = itemRule.attribute ? 
                      getAttribute(childElement, itemRule.attribute) :
                      getTextContent(childElement);
                  }
                  return item;
                } else {
                  // Simple text extraction
                  return rule.attribute ? getAttribute(el, rule.attribute) : getTextContent(el);
                }
              }).filter(item => item !== null && item !== '');
              
            } else if (rule.type === 'table') {
              // Extract table data
              const table = extractByStrategies(rule);
              if (table) {
                const rows = Array.from(table.querySelectorAll('tr'));
                const headers = rows[0] ? Array.from(rows[0].querySelectorAll('th, td')).map(th => getTextContent(th)) : [];
                const data = rows.slice(1).map(row => {
                  const cells = Array.from(row.querySelectorAll('td, th'));
                  const rowData = {};
                  cells.forEach((cell, index) => {
                    const header = headers[index] || \`column_\${index}\`;
                    rowData[header] = getTextContent(cell);
                  });
                  return rowData;
                });
                results[key] = { headers, data };
              } else {
                results[key] = null;
              }
              
            } else {
              // Single element extraction
              const element = extractByStrategies(rule);
              
              if (element) {
                if (rule.attribute) {
                  results[key] = getAttribute(element, rule.attribute);
                } else if (rule.property) {
                  results[key] = element[rule.property];
                } else if (rule.style) {
                  results[key] = window.getComputedStyle(element)[rule.style];
                } else {
                  results[key] = getTextContent(element);
                }
                
                // Apply transformations
                if (rule.transform) {
                  if (rule.transform === 'number') {
                    results[key] = parseFloat(results[key]) || 0;
                  } else if (rule.transform === 'boolean') {
                    results[key] = Boolean(results[key]);
                  } else if (rule.transform === 'trim') {
                    results[key] = results[key]?.toString().trim();
                  }
                }
              } else {
                results[key] = rule.defaultValue || null;
              }
            }
          } catch (error) {
            results[key] = { error: error.message };
          }
        }

        return results;
      };

      return extractData(${JSON.stringify(rules)});
    `;

    return await mcp__playwright__browser_evaluate({ 
      function: `() => { ${extractionScript} }` 
    });
  }

  /**
   * Extract structured data (JSON-LD, microdata, etc.)
   */
  async extractStructuredData(options = {}) {
    const { includeJsonLd = true, includeMicrodata = true } = options;

    const structuredDataScript = `
      const extractStructuredData = () => {
        const results = {};

        // Extract JSON-LD
        if (${includeJsonLd}) {
          const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
          results.jsonLd = Array.from(jsonLdScripts).map(script => {
            try {
              return JSON.parse(script.textContent);
            } catch (e) {
              return { error: 'Invalid JSON-LD', content: script.textContent };
            }
          });
        }

        // Extract microdata
        if (${includeMicrodata}) {
          const microdataItems = document.querySelectorAll('[itemscope]');
          results.microdata = Array.from(microdataItems).map(item => {
            const itemType = item.getAttribute('itemtype');
            const properties = {};
            
            const propElements = item.querySelectorAll('[itemprop]');
            propElements.forEach(prop => {
              const name = prop.getAttribute('itemprop');
              const value = prop.getAttribute('itemvalue') || prop.textContent.trim();
              properties[name] = value;
            });
            
            return { type: itemType, properties };
          });
        }

        // Extract Open Graph meta tags
        const ogTags = {};
        document.querySelectorAll('meta[property^="og:"]').forEach(meta => {
          const property = meta.getAttribute('property');
          const content = meta.getAttribute('content');
          ogTags[property] = content;
        });
        results.openGraph = ogTags;

        // Extract Twitter Card meta tags
        const twitterTags = {};
        document.querySelectorAll('meta[name^="twitter:"]').forEach(meta => {
          const name = meta.getAttribute('name');
          const content = meta.getAttribute('content');
          twitterTags[name] = content;
        });
        results.twitterCard = twitterTags;

        return results;
      };

      return extractStructuredData();
    `;

    return await mcp__playwright__browser_evaluate({ 
      function: `() => { ${structuredDataScript} }` 
    });
  }

  /**
   * Extract form data and structure
   */
  async extractFormData(formSelector = 'form', options = {}) {
    const { includeValues = false, includeValidation = true } = options;

    const formExtractionScript = `
      const extractForms = () => {
        const forms = document.querySelectorAll('${formSelector}');
        return Array.from(forms).map((form, index) => {
          const formData = {
            index,
            id: form.id,
            name: form.name,
            method: form.method || 'GET',
            action: form.action,
            fields: []
          };

          // Extract all form fields
          const fieldSelectors = 'input, select, textarea, button';
          const fields = form.querySelectorAll(fieldSelectors);
          
          formData.fields = Array.from(fields).map(field => {
            const fieldData = {
              tagName: field.tagName.toLowerCase(),
              type: field.type,
              name: field.name,
              id: field.id,
              placeholder: field.placeholder,
              required: field.required,
              disabled: field.disabled,
              readonly: field.readOnly
            };

            if (${includeValues}) {
              if (field.type === 'checkbox' || field.type === 'radio') {
                fieldData.checked = field.checked;
              } else {
                fieldData.value = field.value;
              }
            }

            if (${includeValidation} && field.validity) {
              fieldData.validation = {
                valid: field.validity.valid,
                valueMissing: field.validity.valueMissing,
                typeMismatch: field.validity.typeMismatch,
                patternMismatch: field.validity.patternMismatch,
                tooLong: field.validity.tooLong,
                tooShort: field.validity.tooShort,
                rangeUnderflow: field.validity.rangeUnderflow,
                rangeOverflow: field.validity.rangeOverflow,
                stepMismatch: field.validity.stepMismatch,
                customError: field.validity.customError
              };
            }

            return fieldData;
          });

          return formData;
        });
      };

      return extractForms();
    `;

    return await mcp__playwright__browser_evaluate({ 
      function: `() => { ${formExtractionScript} }` 
    });
  }

  /**
   * Extract page performance metrics
   */
  async extractPerformanceMetrics() {
    const performanceScript = `
      const getPerformanceMetrics = () => {
        const navigation = performance.getEntriesByType('navigation')[0];
        const paint = performance.getEntriesByType('paint');
        const resources = performance.getEntriesByType('resource');

        return {
          navigation: navigation ? {
            domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
            loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
            domInteractive: navigation.domInteractive - navigation.navigationStart,
            firstByte: navigation.responseStart - navigation.navigationStart,
            dns: navigation.domainLookupEnd - navigation.domainLookupStart,
            tcp: navigation.connectEnd - navigation.connectStart,
            request: navigation.responseEnd - navigation.requestStart,
            response: navigation.responseEnd - navigation.responseStart,
            processing: navigation.domComplete - navigation.domLoading,
            total: navigation.loadEventEnd - navigation.navigationStart
          } : null,
          
          paint: paint.reduce((acc, entry) => {
            acc[entry.name] = entry.startTime;
            return acc;
          }, {}),
          
          resources: {
            total: resources.length,
            byType: resources.reduce((acc, resource) => {
              const type = resource.initiatorType || 'other';
              acc[type] = (acc[type] || 0) + 1;
              return acc;
            }, {}),
            totalSize: resources.reduce((sum, resource) => sum + (resource.transferSize || 0), 0),
            slowestResource: resources.reduce((slowest, resource) => 
              resource.duration > (slowest.duration || 0) ? resource : slowest, {})
          },
          
          memory: performance.memory ? {
            used: performance.memory.usedJSHeapSize,
            total: performance.memory.totalJSHeapSize,
            limit: performance.memory.jsHeapSizeLimit
          } : null,
          
          timing: Date.now(),
          userAgent: navigator.userAgent
        };
      };

      return getPerformanceMetrics();
    `;

    return await mcp__playwright__browser_evaluate({ 
      function: `() => { ${performanceScript} }` 
    });
  }

  /**
   * Extract links and navigation structure
   */
  async extractLinks(options = {}) {
    const { 
      includeExternal = true, 
      includeInternal = true,
      includeImages = false 
    } = options;

    const linkExtractionScript = `
      const extractLinks = () => {
        const baseUrl = window.location.origin;
        const links = Array.from(document.querySelectorAll('a[href]'));
        const images = ${includeImages} ? Array.from(document.querySelectorAll('img[src]')) : [];

        const processedLinks = links.map(link => {
          const href = link.href;
          const isExternal = !href.startsWith(baseUrl) && !href.startsWith('/');
          
          return {
            href,
            text: link.textContent.trim(),
            title: link.title,
            target: link.target,
            isExternal,
            rel: link.rel,
            download: link.download
          };
        }).filter(link => {
          if (!${includeExternal} && link.isExternal) return false;
          if (!${includeInternal} && !link.isExternal) return false;
          return true;
        });

        const processedImages = images.map(img => ({
          src: img.src,
          alt: img.alt,
          title: img.title,
          width: img.naturalWidth,
          height: img.naturalHeight,
          loading: img.loading
        }));

        return {
          links: processedLinks,
          images: processedImages,
          summary: {
            totalLinks: processedLinks.length,
            externalLinks: processedLinks.filter(l => l.isExternal).length,
            internalLinks: processedLinks.filter(l => !l.isExternal).length,
            totalImages: processedImages.length
          }
        };
      };

      return extractLinks();
    `;

    return await mcp__playwright__browser_evaluate({ 
      function: `() => { ${linkExtractionScript} }` 
    });
  }

  /**
   * Wait for content to be ready for extraction
   */
  async waitForContentReady(rules, timeout = this.extractionTimeout) {
    const contentSelectors = Object.values(rules)
      .filter(rule => rule.selector)
      .map(rule => rule.selector);

    if (contentSelectors.length === 0) {
      return true;
    }

    const waitScript = `
      const selectors = ${JSON.stringify(contentSelectors)};
      const waitForElements = () => new Promise(resolve => {
        const checkElements = () => {
          const foundElements = selectors.filter(selector => 
            document.querySelector(selector) !== null
          );
          
          // Consider ready if at least 70% of selectors are found
          if (foundElements.length >= selectors.length * 0.7) {
            resolve({
              ready: true,
              found: foundElements.length,
              total: selectors.length
            });
          } else {
            setTimeout(checkElements, 200);
          }
        };
        checkElements();
      });

      return await waitForElements();
    `;

    try {
      const result = await Promise.race([
        mcp__playwright__browser_evaluate({ 
          function: `async () => { ${waitScript} }` 
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Content ready timeout')), timeout)
        )
      ]);

      return result;
    } catch (error) {
      // Continue with extraction even if wait fails
      return { ready: false, error: error.message };
    }
  }

  /**
   * Validate extraction results
   */
  async validateExtraction(data, rules) {
    const validation = {
      valid: true,
      errors: [],
      warnings: []
    };

    for (const [key, rule] of Object.entries(rules)) {
      const value = data[key];

      // Check required fields
      if (rule.required && (value === null || value === undefined || value === '')) {
        validation.valid = false;
        validation.errors.push(`Required field '${key}' is missing or empty`);
      }

      // Check data types
      if (value !== null && rule.expectedType) {
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        if (actualType !== rule.expectedType) {
          validation.warnings.push(`Field '${key}' expected type ${rule.expectedType}, got ${actualType}`);
        }
      }

      // Check minimum array length
      if (rule.type === 'list' && Array.isArray(value) && rule.minItems && value.length < rule.minItems) {
        validation.warnings.push(`Field '${key}' has ${value.length} items, minimum expected: ${rule.minItems}`);
      }
    }

    if (!validation.valid) {
      throw new Error(`Extraction validation failed: ${validation.errors.join(', ')}`);
    }

    return validation;
  }

  // Helper methods

  async waitMs(ms) {
    await mcp__playwright__browser_wait_for({ time: ms / 1000 });
  }

  /**
   * Save extracted data to file (utility method)
   */
  saveDataToFile(data, filename = `extracted_data_${Date.now()}.json`) {
    // This would typically save to a file system
    // Implementation depends on your environment
    return {
      saved: true,
      filename,
      size: JSON.stringify(data).length,
      timestamp: Date.now()
    };
  }
}

module.exports = { DataExtractorPattern };