/**
 * Navigation Pattern - Reusable patterns for page navigation, routing, and URL handling
 * Handles SPAs, multi-page applications, and complex navigation flows
 */
class NavigationPattern {
  constructor() {
    this.defaultTimeout = 5000;
    this.navigationTimeout = 10000;
  }

  /**
   * Smart navigation with retry and validation
   * Handles redirects, loading states, and navigation failures
   */
  async navigateToPage(url, options = {}) {
    const { 
      waitForLoad = true,
      validateUrl = true,
      retryAttempts = 3,
      timeout = this.navigationTimeout 
    } = options;

    let attempt = 0;
    while (attempt < retryAttempts) {
      try {
        await mcp__playwright__browser_navigate({ url });
        
        if (waitForLoad) {
          await this.waitForPageLoad(timeout);
        }
        
        if (validateUrl) {
          await this.validateNavigation(url);
        }
        
        return { success: true, url, attempts: attempt + 1 };
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
   * SPA route navigation
   * Handles single-page application routing without page reload
   */
  async navigateToRoute(route, options = {}) {
    const { 
      baseUrl = '',
      useHistory = true,
      waitForContent = true 
    } = options;

    const navigationScript = `
      const navigateToRoute = (route, useHistory) => {
        const fullUrl = '${baseUrl}' + route;
        
        if (useHistory && window.history && window.history.pushState) {
          // Use pushState for SPA navigation
          window.history.pushState({}, '', route);
          
          // Trigger route change event
          const event = new PopStateEvent('popstate', { state: {} });
          window.dispatchEvent(event);
          
          return { method: 'pushState', url: window.location.href };
        } else {
          // Fallback to location change
          window.location.href = fullUrl;
          return { method: 'location', url: fullUrl };
        }
      };

      return navigateToRoute('${route}', ${useHistory});
    `;

    const result = await mcp__playwright__browser_evaluate({ 
      function: `() => { ${navigationScript} }` 
    });

    if (waitForContent) {
      await this.waitForRouteContent(route);
    }

    return result;
  }

  /**
   * Multi-step navigation flow
   * Handles complex navigation sequences with validation
   */
  async navigateFlow(steps, options = {}) {
    const { validateEachStep = true, continueOnError = false } = options;
    const results = [];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      try {
        let stepResult;

        switch (step.type) {
          case 'url':
            stepResult = await this.navigateToPage(step.target, step.options);
            break;
          case 'route':
            stepResult = await this.navigateToRoute(step.target, step.options);
            break;
          case 'click':
            stepResult = await this.clickNavigationElement(step.target, step.options);
            break;
          case 'back':
            stepResult = await this.goBack(step.options);
            break;
          case 'forward':
            stepResult = await this.goForward(step.options);
            break;
          default:
            throw new Error(`Unknown navigation step type: ${step.type}`);
        }

        if (validateEachStep && step.validation) {
          await this.validateStep(step.validation);
        }

        results.push({ step: i + 1, success: true, result: stepResult });
      } catch (error) {
        results.push({ step: i + 1, success: false, error: error.message });
        
        if (!continueOnError) {
          throw new Error(`Navigation flow failed at step ${i + 1}: ${error.message}`);
        }
      }
    }

    return { success: true, steps: results };
  }

  /**
   * Click-based navigation
   * Handles navigation via clicking links, buttons, etc.
   */
  async clickNavigationElement(selector, options = {}) {
    const { 
      waitForNavigation = true,
      timeout = this.defaultTimeout,
      newTab = false 
    } = options;

    try {
      if (newTab) {
        // Handle new tab navigation
        const clickScript = `
          const element = document.querySelector('${selector}');
          if (element) {
            // Add target="_blank" if not present
            if (element.tagName === 'A' && !element.target) {
              element.target = '_blank';
            }
            element.click();
            return { clicked: true, newTab: true };
          }
          throw new Error('Navigation element not found: ${selector}');
        `;

        await mcp__playwright__browser_evaluate({ 
          function: `() => { ${clickScript} }` 
        });
      } else {
        // Standard navigation click
        await mcp__playwright__browser_click({ 
          element: `Navigation element: ${selector}`,
          ref: selector 
        });
      }

      if (waitForNavigation) {
        await this.waitForPageLoad(timeout);
      }

      return { success: true, selector };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Browser back navigation
   */
  async goBack(options = {}) {
    const { waitForLoad = true } = options;

    try {
      await mcp__playwright__browser_navigate_back();
      
      if (waitForLoad) {
        await this.waitForPageLoad();
      }

      const currentUrl = await this.getCurrentUrl();
      return { success: true, currentUrl };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Browser forward navigation
   */
  async goForward(options = {}) {
    const { waitForLoad = true } = options;

    try {
      await mcp__playwright__browser_navigate_forward();
      
      if (waitForLoad) {
        await this.waitForPageLoad();
      }

      const currentUrl = await this.getCurrentUrl();
      return { success: true, currentUrl };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * URL validation and monitoring
   */
  async validateNavigation(expectedUrl, options = {}) {
    const { 
      exactMatch = false,
      timeout = this.defaultTimeout 
    } = options;

    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const currentUrl = await this.getCurrentUrl();
      
      const isValid = exactMatch 
        ? currentUrl === expectedUrl
        : currentUrl.includes(expectedUrl) || expectedUrl.includes(currentUrl);

      if (isValid) {
        return { valid: true, currentUrl, expectedUrl };
      }

      await this.waitMs(500);
    }

    throw new Error(`URL validation failed. Expected: ${expectedUrl}, Current: ${await this.getCurrentUrl()}`);
  }

  /**
   * Wait for page load completion
   */
  async waitForPageLoad(timeout = this.navigationTimeout) {
    const loadScript = `
      // Wait for document ready state
      if (document.readyState === 'loading') {
        await new Promise(resolve => {
          document.addEventListener('DOMContentLoaded', resolve, { once: true });
        });
      }

      // Wait for network idle (no active requests for 500ms)
      let activeRequests = 0;
      const originalFetch = window.fetch;
      const originalXHROpen = XMLHttpRequest.prototype.open;

      // Monitor fetch requests
      window.fetch = async (...args) => {
        activeRequests++;
        try {
          const response = await originalFetch(...args);
          activeRequests--;
          return response;
        } catch (error) {
          activeRequests--;
          throw error;
        }
      };

      // Monitor XHR requests
      XMLHttpRequest.prototype.open = function(...args) {
        activeRequests++;
        this.addEventListener('loadend', () => activeRequests--);
        return originalXHROpen.apply(this, args);
      };

      // Wait for network idle
      const waitForIdle = () => new Promise(resolve => {
        const checkIdle = () => {
          if (activeRequests === 0) {
            setTimeout(resolve, 500); // 500ms of idle time
          } else {
            setTimeout(checkIdle, 100);
          }
        };
        checkIdle();
      });

      await waitForIdle();

      // Restore original functions
      window.fetch = originalFetch;
      XMLHttpRequest.prototype.open = originalXHROpen;

      return {
        readyState: document.readyState,
        url: window.location.href,
        loadComplete: true
      };
    `;

    try {
      const result = await Promise.race([
        mcp__playwright__browser_evaluate({ 
          function: `async () => { ${loadScript} }` 
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Page load timeout')), timeout)
        )
      ]);

      return result;
    } catch (error) {
      // Fallback to simple wait
      await this.waitMs(2000);
      return { loadComplete: false, fallback: true };
    }
  }

  /**
   * Wait for specific route content to load
   */
  async waitForRouteContent(route, options = {}) {
    const { 
      contentSelector = 'main, .content, #content, [role="main"]',
      timeout = this.defaultTimeout 
    } = options;

    const waitScript = `
      const waitForContent = () => new Promise(resolve => {
        const checkContent = () => {
          // Check if URL matches route
          const urlMatches = window.location.pathname.includes('${route}') || 
                            window.location.hash.includes('${route}');
          
          // Check if content is present
          const contentElement = document.querySelector('${contentSelector}');
          const hasContent = contentElement && contentElement.children.length > 0;
          
          if (urlMatches && hasContent) {
            resolve({
              routeLoaded: true,
              url: window.location.href,
              contentFound: true
            });
          } else {
            setTimeout(checkContent, 100);
          }
        };
        
        checkContent();
      });

      return await waitForContent();
    `;

    try {
      const result = await Promise.race([
        mcp__playwright__browser_evaluate({ 
          function: `async () => { ${waitScript} }` 
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Route content timeout')), timeout)
        )
      ]);

      return result;
    } catch (error) {
      return { routeLoaded: false, error: error.message };
    }
  }

  /**
   * Get current URL
   */
  async getCurrentUrl() {
    return await mcp__playwright__browser_evaluate({ 
      function: '() => window.location.href' 
    });
  }

  /**
   * Get current route info
   */
  async getRouteInfo() {
    const routeScript = `
      return {
        href: window.location.href,
        pathname: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash,
        origin: window.location.origin,
        host: window.location.host
      };
    `;

    return await mcp__playwright__browser_evaluate({ 
      function: `() => { ${routeScript} }` 
    });
  }

  /**
   * Validate navigation step
   */
  async validateStep(validation) {
    const { url, content, element } = validation;

    if (url) {
      await this.validateNavigation(url);
    }

    if (content) {
      await this.waitForText(content);
    }

    if (element) {
      await this.waitForElement(element);
    }
  }

  /**
   * Wait for text to appear on page
   */
  async waitForText(text, timeout = this.defaultTimeout) {
    try {
      await mcp__playwright__browser_wait_for({ text, time: timeout / 1000 });
    } catch (error) {
      throw new Error(`Text "${text}" not found within ${timeout}ms`);
    }
  }

  /**
   * Wait for element to appear
   */
  async waitForElement(selector, timeout = this.defaultTimeout) {
    const waitScript = `
      const waitForElement = () => new Promise(resolve => {
        const checkElement = () => {
          const element = document.querySelector('${selector}');
          if (element) {
            resolve({ found: true, element: element.tagName });
          } else {
            setTimeout(checkElement, 100);
          }
        };
        checkElement();
      });

      return await waitForElement();
    `;

    try {
      const result = await Promise.race([
        mcp__playwright__browser_evaluate({ 
          function: `async () => { ${waitScript} }` 
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`Element "${selector}" timeout`)), timeout)
        )
      ]);

      return result;
    } catch (error) {
      throw new Error(`Element "${selector}" not found within ${timeout}ms`);
    }
  }

  // Helper methods

  async waitMs(ms) {
    await mcp__playwright__browser_wait_for({ time: ms / 1000 });
  }
}

module.exports = { NavigationPattern };