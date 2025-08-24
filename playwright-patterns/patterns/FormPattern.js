/**
 * Form Pattern - Reusable patterns for form handling, validation, and submission
 * Handles various form types including dynamic forms, multi-step forms, and validation
 */
class FormPattern {
  constructor() {
    this.defaultTimeout = 5000;
    this.fillDelay = 100; // Delay between form field fills
  }

  /**
   * Universal form filler
   * Automatically detects and fills form fields based on data object
   */
  async fillForm(formData, options = {}) {
    const { 
      selector = 'form', 
      validateAfterFill = true,
      submitAfterFill = false 
    } = options;

    try {
      const fillResult = await this.fillFormFields(formData, selector);
      
      if (validateAfterFill) {
        await this.validateFormData(formData, selector);
      }
      
      if (submitAfterFill) {
        await this.submitForm(selector);
      }
      
      return { success: true, fieldsProcessed: fillResult.fieldsProcessed };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Smart form field detection and filling
   * Uses multiple strategies to find and fill fields
   */
  async fillFormFields(formData, containerSelector = 'form') {
    const fillScript = `
      const setValue = (input, value) => {
        if (!input) return false;
        
        // Handle different input types
        if (input.type === 'checkbox' || input.type === 'radio') {
          input.checked = value;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        } else if (input.tagName === 'SELECT') {
          input.value = value;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          // Text inputs
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype, 
            "value"
          ).set;
          nativeInputValueSetter.call(input, value);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
        return true;
      };

      const findField = (key, value) => {
        const container = document.querySelector('${containerSelector}') || document;
        const strategies = [
          // By name attribute
          () => container.querySelector(\`input[name="\${key}"]\`),
          () => container.querySelector(\`select[name="\${key}"]\`),
          () => container.querySelector(\`textarea[name="\${key}"]\`),
          
          // By id
          () => container.querySelector(\`#\${key}\`),
          
          // By data attributes
          () => container.querySelector(\`[data-field="\${key}"]\`),
          () => container.querySelector(\`[data-name="\${key}"]\`),
          
          // By placeholder text
          () => container.querySelector(\`input[placeholder*="\${key}"]\`),
          
          // By label text
          () => {
            const label = Array.from(container.querySelectorAll('label')).find(l => 
              l.textContent.toLowerCase().includes(key.toLowerCase())
            );
            return label ? container.querySelector(\`#\${label.getAttribute('for')}\`) : null;
          },
          
          // By type inference
          () => {
            if (key.toLowerCase().includes('email')) return container.querySelector('input[type="email"]');
            if (key.toLowerCase().includes('password')) return container.querySelector('input[type="password"]');
            if (key.toLowerCase().includes('phone')) return container.querySelector('input[type="tel"]');
            if (key.toLowerCase().includes('date')) return container.querySelector('input[type="date"]');
            return null;
          }
        ];
        
        for (const strategy of strategies) {
          try {
            const field = strategy();
            if (field && !field.disabled && !field.readOnly) {
              return field;
            }
          } catch (e) {
            // Continue to next strategy
          }
        }
        return null;
      };

      const formData = ${JSON.stringify(formData)};
      const results = {};
      let fieldsProcessed = 0;

      for (const [key, value] of Object.entries(formData)) {
        const field = findField(key, value);
        if (field && setValue(field, value)) {
          results[key] = { success: true, element: field.tagName + (field.type ? '[' + field.type + ']' : '') };
          fieldsProcessed++;
          
          // Small delay between fields
          await new Promise(r => setTimeout(r, ${this.fillDelay}));
        } else {
          results[key] = { success: false, error: 'Field not found or not fillable' };
        }
      }

      return { results, fieldsProcessed, totalFields: Object.keys(formData).length };
    `;

    return await mcp__playwright__browser_evaluate({ 
      function: `async () => { ${fillScript} }` 
    });
  }

  /**
   * Form validation checker
   * Verifies that form data was filled correctly
   */
  async validateFormData(expectedData, containerSelector = 'form') {
    const validateScript = `
      const container = document.querySelector('${containerSelector}') || document;
      const expectedData = ${JSON.stringify(expectedData)};
      const validationResults = {};
      let allValid = true;

      for (const [key, expectedValue] of Object.entries(expectedData)) {
        // Find field using same strategies as fillFormFields
        const field = container.querySelector(\`input[name="\${key}"]\`) ||
                     container.querySelector(\`select[name="\${key}"]\`) ||
                     container.querySelector(\`textarea[name="\${key}"]\`) ||
                     container.querySelector(\`#\${key}\`);

        if (field) {
          const actualValue = field.type === 'checkbox' || field.type === 'radio' 
            ? field.checked 
            : field.value;
          
          const isValid = actualValue == expectedValue; // Use loose equality for type flexibility
          validationResults[key] = { 
            expected: expectedValue, 
            actual: actualValue, 
            valid: isValid 
          };
          
          if (!isValid) allValid = false;
        } else {
          validationResults[key] = { 
            expected: expectedValue, 
            actual: null, 
            valid: false, 
            error: 'Field not found' 
          };
          allValid = false;
        }
      }

      return { allValid, validationResults };
    `;

    const validation = await mcp__playwright__browser_evaluate({ 
      function: `() => { ${validateScript} }` 
    });

    if (!validation.allValid) {
      throw new Error(`Form validation failed: ${JSON.stringify(validation.validationResults)}`);
    }

    return validation;
  }

  /**
   * Smart form submission
   * Finds and clicks submit button using multiple strategies
   */
  async submitForm(containerSelector = 'form', options = {}) {
    const { waitForResponse = true, timeout = this.defaultTimeout } = options;

    const submitScript = `
      const container = document.querySelector('${containerSelector}') || document;
      
      // Find submit button strategies
      const findSubmitButton = () => {
        const strategies = [
          // Direct submit button
          () => container.querySelector('button[type="submit"]'),
          () => container.querySelector('input[type="submit"]'),
          
          // Form's submit button
          () => {
            const form = container.tagName === 'FORM' ? container : container.querySelector('form');
            return form ? form.querySelector('button[type="submit"], input[type="submit"]') : null;
          },
          
          // By text content
          () => Array.from(container.querySelectorAll('button')).find(b => 
            b.textContent.toLowerCase().includes('submit') ||
            b.textContent.toLowerCase().includes('save') ||
            b.textContent.toLowerCase().includes('send') ||
            b.textContent.toLowerCase().includes('create') ||
            b.textContent.toLowerCase().includes('update')
          ),
          
          // Primary button (often submit)
          () => container.querySelector('button.primary, button.btn-primary, .button-primary'),
          
          // Last button in form (common pattern)
          () => {
            const buttons = container.querySelectorAll('button');
            return buttons.length > 0 ? buttons[buttons.length - 1] : null;
          }
        ];
        
        for (const strategy of strategies) {
          try {
            const button = strategy();
            if (button && !button.disabled) {
              return button;
            }
          } catch (e) {
            // Continue to next strategy
          }
        }
        return null;
      };

      const submitBtn = findSubmitButton();
      if (submitBtn) {
        submitBtn.click();
        return { submitted: true, buttonText: submitBtn.textContent.trim() };
      }
      
      throw new Error('Submit button not found');
    `;

    const result = await mcp__playwright__browser_evaluate({ 
      function: `() => { ${submitScript} }` 
    });

    if (waitForResponse) {
      await this.waitMs(1000); // Wait for form processing
    }

    return result;
  }

  /**
   * Multi-step form handler
   * Handles forms that span multiple steps/pages
   */
  async fillMultiStepForm(steps, options = {}) {
    const { waitBetweenSteps = 1000 } = options;
    const results = [];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      try {
        // Fill current step
        const fillResult = await this.fillForm(step.data, {
          selector: step.selector,
          validateAfterFill: step.validate !== false
        });

        // Navigate to next step if not last
        if (i < steps.length - 1) {
          if (step.nextButton) {
            await this.clickElement(step.nextButton);
          } else {
            await this.submitForm(step.selector, { waitForResponse: false });
          }
          
          await this.waitMs(waitBetweenSteps);
        } else if (step.submitAfterFill !== false) {
          // Submit final step
          await this.submitForm(step.selector);
        }

        results.push({ step: i + 1, success: true, result: fillResult });
      } catch (error) {
        results.push({ step: i + 1, success: false, error: error.message });
        throw new Error(`Multi-step form failed at step ${i + 1}: ${error.message}`);
      }
    }

    return { success: true, steps: results };
  }

  /**
   * Dynamic form handler
   * Handles forms that change based on user input
   */
  async fillDynamicForm(formData, options = {}) {
    const { 
      watchForChanges = true, 
      maxAttempts = 3,
      delayAfterChange = 500 
    } = options;

    let attempt = 0;
    while (attempt < maxAttempts) {
      try {
        const fillResult = await this.fillFormFields(formData);
        
        if (watchForChanges) {
          // Wait for any dynamic changes
          await this.waitMs(delayAfterChange);
          
          // Check if form structure changed
          const recheckResult = await this.validateFormData(formData);
          if (!recheckResult.allValid) {
            // Form changed, retry
            attempt++;
            continue;
          }
        }
        
        return fillResult;
      } catch (error) {
        attempt++;
        if (attempt >= maxAttempts) {
          throw error;
        }
        await this.waitMs(delayAfterChange);
      }
    }
  }

  // Helper methods

  async clickElement(selector) {
    const clickScript = `
      const element = document.querySelector('${selector}');
      if (element) {
        element.click();
        return { clicked: true };
      }
      throw new Error('Element not found: ${selector}');
    `;

    return await mcp__playwright__browser_evaluate({ 
      function: `() => { ${clickScript} }` 
    });
  }

  async waitMs(ms) {
    await mcp__playwright__browser_wait_for({ time: ms / 1000 });
  }

  /**
   * File upload handler
   * Handles file upload fields with validation
   */
  async uploadFile(filePath, options = {}) {
    const { fieldSelector = 'input[type="file"]' } = options;

    try {
      // Use MCP file upload tool
      await mcp__playwright__browser_file_upload({ paths: [filePath] });
      
      // Verify upload initiated
      const verifyScript = `
        const fileInput = document.querySelector('${fieldSelector}');
        return {
          hasFiles: fileInput && fileInput.files.length > 0,
          fileCount: fileInput ? fileInput.files.length : 0,
          fileName: fileInput && fileInput.files[0] ? fileInput.files[0].name : null
        };
      `;

      const verification = await mcp__playwright__browser_evaluate({ 
        function: `() => { ${verifyScript} }` 
      });

      return { success: true, upload: verification };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = { FormPattern };