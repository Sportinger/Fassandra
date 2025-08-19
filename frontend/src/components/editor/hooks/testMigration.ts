// Test file to verify migration logic
export function testMigration() {
  const testText = `TEST MIGRATION SCRIPT

By Test Author

---

[SCENE] Interior - Coffee Shop - Day

(The coffee shop is bustling with morning customers)

ALICE: This content should now be visible in the editor!

BOB: Yes, the migration hook should handle it properly.`;

  const lines = testText.split('\n').filter(line => line.trim());
  let htmlContent = '';
  
  for (const line of lines) {
    if (line === '---') {
      continue; // Skip dividers
    } else if (line.startsWith('[SCENE]')) {
      const sceneText = line.replace('[SCENE]', '').trim();
      htmlContent += `<div data-type="scene-block"><p>${sceneText}</p></div>`;
    } else if (line.startsWith('(') && line.endsWith(')')) {
      const stageDirection = line.slice(1, -1);
      htmlContent += `<div data-type="cue-block"><p>${stageDirection}</p></div>`;
    } else if (line.includes(':')) {
      const [speaker, ...dialogueParts] = line.split(':');
      const dialogue = dialogueParts.join(':').trim();
      htmlContent += `<div data-type="dialogue-block"><span data-type="speaker">${speaker.trim()}</span><span data-type="dialogue-text">${dialogue}</span></div>`;
    } else {
      htmlContent += `<p>${line}</p>`;
    }
  }
  
  console.log('Migration Test Result:');
  console.log(htmlContent);
  return htmlContent;
}

// Run test
if (typeof window !== 'undefined') {
  (window as any).testMigration = testMigration;
  console.log('Migration test available. Run testMigration() in console.');
}