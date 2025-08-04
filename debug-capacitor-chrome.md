# Debug Pessoa App with Chrome DevTools

## Steps to debug the Capacitor app:

1. **On your Android device:**
   - Open Chrome browser
   - Go to: `chrome://inspect`
   - You should see your Pessoa app listed

2. **Alternative method - USB debugging:**
   - On your computer, open Chrome
   - Navigate to: `chrome://inspect/#devices`
   - You should see your device and the Pessoa app
   - Click "inspect" next to the app

3. **In DevTools Console, check:**
   ```javascript
   // Check API base URL
   console.log(window.location.href);
   
   // Check if API calls are being made
   fetch('/api/health').then(r => r.text()).then(console.log);
   
   // Check environment variables
   console.log(import.meta.env);
   ```

4. **Common issues:**
   - If you see HTML instead of JSON, the app might be trying to load from file:// instead of http://
   - Check Network tab to see actual requests being made

## Quick fix to test:

Open the app and in Chrome DevTools console, run:
```javascript
// Override the API URL temporarily
window.API_BASE_URL = 'http://192.168.2.111:3000';
```