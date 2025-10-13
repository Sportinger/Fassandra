export type CueType = 'light' | 'video' | 'sound' | 'props' | 'technik' | 'einruf';

export interface CueMetadata {
  cue_number?: string;
  description?: string;
  duration?: string;
  notes?: string;
}

export interface CueBlock {
  type: 'cue_light' | 'cue_video' | 'cue_sound' | 'cue_props' | 'cue_technik' | 'cue_einruf';
  content: string;
  metadata?: CueMetadata;
}

export const CUE_TYPE_LABELS: Record<CueType, string> = {
  light: 'Licht',
  video: 'Video',
  sound: 'Ton',
  props: 'Requisite',
  technik: 'Technik',
  einruf: 'Einruf'
};

export const CUE_TYPE_ICONS: Record<CueType, string> = {
  light: '💡',
  video: '🎥', // Changed from 🎬 to camera icon
  sound: '🔊',
  props: '🎭',
  technik: '🔨', // Hammer for technical cues
  einruf: '📢' // Megaphone for call cues
};