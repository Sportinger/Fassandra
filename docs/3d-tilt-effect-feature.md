# 3D Tilt Effect for Script Cards

## Feature Overview
Interactive 3D tilt effect for script cards that responds to mouse position, creating a subtle depth and interactivity enhancement.

## Specifications

### Tilt Behavior
- **Multi-axis rotation**: Cards tilt on both X and Y axes simultaneously based on cursor position
  - Top hover → tilts away (rotateX: -5° to -10°)
  - Bottom hover → tilts toward (rotateX: 5° to 10°)
  - Left hover → tilts left (rotateY: -5° to -10°)
  - Right hover → tilts right (rotateY: 5° to 10°)
  - Corner positions combine both axes for diagonal tilts

### Animation Properties
- **Intensity**: Subtle (5-10° maximum tilt angle)
- **Damping**: Light smoothing/easing on all movements
  - Mouse tracking: ~50-100ms transition with ease-out
  - Creates natural, non-jittery movement
  - Slight "catch-up" effect at the end of rapid movements
- **Reset**: Near-instant return to flat with subtle damping (~150-200ms)

### Visual Effects
All effects should be subtle and professional:

1. **Shine/Gloss Effect**
   - Semi-transparent gradient overlay that moves with mouse position
   - Simulates light reflection on the card surface
   - Opacity: 10-20% white gradient

2. **Dynamic Shadow**
   - Shadow shifts opposite to tilt direction
   - Creates illusion of card lifting off the page
   - Shadow blur and distance increase slightly on hover

3. **Scale Enhancement**
   - Slight scale increase on hover (1.02-1.05x)
   - Combined with tilt for depth perception

4. **Parallax Layers**
   - Title, date, and badges move at slightly different rates
   - Background thumbnail (if present) has minimal movement
   - Foreground elements have slightly more movement
   - Creates depth between card layers

### Applied Components
- ✅ All script cards (`ScriptCard`)
- ✅ Create new script card (`ScriptCreator` - the "+" card)
- ✅ Upload placeholder cards (during upload progress)

## Technical Implementation

### Mouse Position Tracking
```javascript
// Calculate position relative to card center
const rect = card.getBoundingClientRect();
const centerX = rect.left + rect.width / 2;
const centerY = rect.top + rect.height / 2;
const percentX = (mouseX - centerX) / (rect.width / 2);
const percentY = (mouseY - centerY) / (rect.height / 2);
```

### Transform Calculation
```javascript
// Subtle tilt angles
const tiltX = percentY * -8; // -8° to 8°
const tiltY = percentX * 8;  // -8° to 8°
```

### CSS Properties
```css
.scriptCard {
  transition: transform 0.1s ease-out; /* Light damping */
  transform-style: preserve-3d;
  transform-origin: center center;
}

.scriptCardContainer {
  perspective: 1000px; /* Creates 3D space */
}
```

### Performance Considerations
- Use `will-change: transform` on hover only
- Throttle mousemove events to 60fps using requestAnimationFrame
- Use CSS transforms rather than JavaScript animations
- Batch DOM reads/writes to avoid layout thrashing

## Accessibility
- Effect is purely visual enhancement
- Card functionality remains unchanged
- Keyboard navigation unaffected
- Respects `prefers-reduced-motion` media query

## Browser Compatibility
- Modern browsers with CSS 3D transform support
- Graceful degradation for older browsers (cards remain functional without tilt)
- Mobile: Consider touch events for tablets (optional enhancement)

## Implementation Checklist
- [ ] Add mouse tracking hooks to ScriptCard component
- [ ] Implement tilt calculation logic
- [ ] Add CSS 3D transforms and transitions
- [ ] Create shine/gloss overlay element
- [ ] Implement dynamic shadow
- [ ] Add parallax to card elements
- [ ] Apply to ScriptCreator component
- [ ] Apply to upload placeholders
- [ ] Test performance with many cards
- [ ] Add prefers-reduced-motion support
- [ ] Test browser compatibility