# Gemini API Response Structure Summary

## Overview
The Gemini API successfully parsed the Frankenstein DOCX file and extracted structured theatrical content.

## Top-Level Structure
```json
{
    "source_filename": null,
    "title": "FRANKENSTEIN",
    "subtitle": null,
    "adaptation_by": ["Katrin Sadlowski", "Anika Steinhoff", "Jette Steckel"],
    "sections": [...],
    "extra": {}
}
```

## Sections Found: 2

### Section 1: "PROLOG"
- **Participants**: ["ALLE"]
- **Setting**: "Stimme vom Band"
- **Content Type**: Monologue
- **Content**: Long monologue with 34+ lines including both English and German text
- **Sample Lines**:
  - "Who am I?"
  - "I am in a strange state of mind."
  - "I am alone, quite alone in the world"

### Section 2: "DER TOD, MARY ERFINDET EINE SCHAUERGESCHICHTE"
- **Participants**: ["MAREN", "FELIX", "ALEXANDER"]
- **Setting**: "Maren, Felix und Alexander in der Ur-Form/Homo Sapiens"
- **Content Type**: Dialogue (59 entries)
- **Sample Dialogues**:

```json
{
    "type": "dialogue",
    "speaker": "MAREN",
    "line": "Menschen sterben. Der Tod ist ein zu schrecklicher Gegenstand. Menschen vertragen nicht sehr viel Realität. Deshalb erfinden wir Geschichten."
}
```

```json
{
    "type": "dialogue",
    "speaker": "FELIX", 
    "line": "Und was, wenn wir die Geschichten sind, die wir erfinden?"
}
```

```json
{
    "type": "dialogue",
    "speaker": "ALEXANDER",
    "line": "Schon als Kind war es meine Lieblingsbeschäftigung, in den Stunden, die ich mir selbst überlassen war, Geschichten zu erzählen..."
}
```

## Key Success Indicators

✅ **Proper Schema**: Uses `"line"` field for dialogue content (not just `"speaker"`)
✅ **Rich Content**: Actual dialogue text extracted, not empty
✅ **Character Recognition**: Correctly identifies speakers (MAREN, FELIX, ALEXANDER)
✅ **Structure Recognition**: Distinguishes between monologue and dialogue
✅ **Bilingual Support**: Handles both German and English text
✅ **Complex Dialogue**: Handles multi-speaker entries like "ALEXANDER / MAREN"

## Comparison with Problematic Cached Response

**❌ OLD (Cached - Broken)**:
```json
{
    "type": "dialogue",
    "speaker": "MAREN",
    "speakers": null
}
```

**✅ NEW (Fresh API Call - Working)**:
```json
{
    "type": "dialogue", 
    "speaker": "MAREN",
    "line": "Menschen sterben. Der Tod ist ein zu schrecklicher Gegenstand..."
}
```

The key difference is the presence of the `"line"` field with actual content! 