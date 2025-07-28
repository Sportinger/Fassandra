export type CueType = 'light' | 'video' | 'sound' | 'props';

export interface CueMetadata {
  cue_number?: string;
  description?: string;
  duration?: string;
  notes?: string;
}

export interface CueBlock {
  type: 'cue_light' | 'cue_video' | 'cue_sound' | 'cue_props';
  content: string;
  metadata?: CueMetadata;
}

export const CUE_TYPE_LABELS: Record<CueType, string> = {
  light: 'Licht',
  video: 'Video',
  sound: 'Ton',
  props: 'Requisite'
};

export const CUE_TYPE_ICONS: Record<CueType, string> = {
  light: '💡',
  video: '🎬',
  sound: '🔊',
  props: '🎭'
};