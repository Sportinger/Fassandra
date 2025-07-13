/**
 * Playwright Vision Debug Helper
 * Automatically organizes screenshots and provides debugging utilities
 */

const fs = require('fs');
const path = require('path');

class DebugHelper {
  constructor() {
    this.debugDir = './debug-screenshots/mcp-vision';
    this.timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    this.sessionDir = path.join(this.debugDir, this.timestamp);
    this.screenshotCounter = 1;
    
    // Ensure directories exist
    this.ensureDirectories();
  }

  ensureDirectories() {
    if (!fs.existsSync(this.debugDir)) {
      fs.mkdirSync(this.debugDir, { recursive: true });
    }
    if (!fs.existsSync(this.sessionDir)) {
      fs.mkdirSync(this.sessionDir, { recursive: true });
    }
  }

  getScreenshotPath(stepName = '') {
    const cleanStepName = stepName.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
    const filename = `${String(this.screenshotCounter).padStart(2, '0')}-${cleanStepName || 'debug'}.png`;
    this.screenshotCounter++;
    return path.join(this.sessionDir, filename);
  }

  getLatestScreenshot() {
    if (!fs.existsSync(this.sessionDir)) return null;
    
    const files = fs.readdirSync(this.sessionDir)
      .filter(file => file.endsWith('.png'))
      .map(file => ({
        name: file,
        path: path.join(this.sessionDir, file),
        time: fs.statSync(path.join(this.sessionDir, file)).mtime
      }))
      .sort((a, b) => b.time - a.time);
    
    return files.length > 0 ? files[0].path : null;
  }

  getDebugSummary() {
    const screenshots = fs.readdirSync(this.sessionDir)
      .filter(file => file.endsWith('.png'))
      .length;
    
    return {
      sessionDir: this.sessionDir,
      totalScreenshots: screenshots,
      latestScreenshot: this.getLatestScreenshot(),
      timestamp: this.timestamp
    };
  }

  createDebugReport(testResults = {}) {
    const report = {
      timestamp: new Date().toISOString(),
      session: this.getDebugSummary(),
      testResults,
      // Add any additional debug info here
    };
    
    const reportPath = path.join(this.sessionDir, 'debug-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    return reportPath;
  }
}

module.exports = { DebugHelper }; 