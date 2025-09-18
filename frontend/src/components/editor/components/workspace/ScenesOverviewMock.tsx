import React, { useEffect, useMemo, useState } from 'react';
import { useEditorSidebar } from '../../contexts/EditorUiContext';

const CAST_LIBRARY: Record<string, Array<{ role: string; actor: string; notes?: string }>> = {
  '1': [
    { role: 'Narrator', actor: 'J. Alvarez', notes: 'Opens scene with voiceover' },
    { role: 'Protagonist', actor: 'M. Becker', notes: 'On stage entire scene' },
    { role: 'Stagehand', actor: 'Crew B', notes: 'Cue Q201 (video)' },
  ],
  '2': [
    { role: 'Lead', actor: 'A. Singh', notes: 'Dialogue-heavy section' },
    { role: 'Antagonist', actor: 'S. Ito', notes: 'Enter from SL with props' },
  ],
  '3': [
    { role: 'Ensemble', actor: 'Company', notes: 'Choreography block' },
    { role: 'Lighting operator', actor: 'Tech 2', notes: 'Watch Q301 handoff' },
  ],
  default: [
    { role: 'TBD role', actor: 'Assign actor', notes: 'Use drag-and-drop from cast list later' },
    { role: 'Stage management', actor: 'Stage team', notes: 'Confirm rehearsal call' },
  ],
};

const getMockCast = (sceneNumber: string | undefined) => {
  if (!sceneNumber) return CAST_LIBRARY.default;
  const key = sceneNumber.split('.')[0] || 'default';
  return CAST_LIBRARY[key] ?? CAST_LIBRARY.default;
};

export const ScenesOverviewMock: React.FC = () => {
  const { sidebarScenes, sidebarCues } = useEditorSidebar();
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);

  useEffect(() => {
    if (sidebarScenes.length && !selectedSceneId) {
      setSelectedSceneId(sidebarScenes[0].id);
    }
  }, [sidebarScenes, selectedSceneId]);

  useEffect(() => {
    if (selectedSceneId && !sidebarScenes.some(scene => scene.id === selectedSceneId) && sidebarScenes.length) {
      setSelectedSceneId(sidebarScenes[0].id);
    }
  }, [sidebarScenes, selectedSceneId]);

  if (sidebarScenes.length === 0) {
    return (
      <div className="workspace-view scenes-overview">
        <div className="placeholder-card">
          <h3>Scenes overview</h3>
          <p>Scenes will appear here as soon as the script contains scene markers.</p>
          <p className="muted">Use the editor to add a scene block to get started.</p>
        </div>
      </div>
    );
  }

  const selectedScene = sidebarScenes.find(scene => scene.id === selectedSceneId) ?? sidebarScenes[0];
  const cuesForScene = sidebarCues
    .filter(cue => cue.cueNumber && selectedScene.sceneNumber && cue.cueNumber.startsWith(selectedScene.sceneNumber))
    .slice(0, 6);
  const fallbackCues = sidebarCues.slice(0, 6);
  const cuesToDisplay = cuesForScene.length ? cuesForScene : fallbackCues;
  const cast = getMockCast(selectedScene.sceneNumber);

  return (
    <div className="workspace-view scenes-overview">
      <div className="scenes-list" role="tablist" aria-label="Scenes list">
        {sidebarScenes.map(scene => (
          <button
            key={scene.id}
            type="button"
            role="tab"
            aria-selected={scene.id === selectedScene.id}
            className={`scene-item ${scene.id === selectedScene.id ? 'active' : ''}`}
            onClick={() => setSelectedSceneId(scene.id)}
          >
            <span className="scene-number">Scene {scene.sceneNumber || scene.index + 1}</span>
            <span className="scene-name">{scene.sceneName || 'Untitled scene'}</span>
          </button>
        ))}
      </div>

      <div className="scene-detail">
        <header>
          <h3>{selectedScene.sceneName || 'Untitled scene'}</h3>
          <p>Scene {selectedScene.sceneNumber || selectedScene.index + 1}</p>
        </header>

        <section className="scene-section">
          <h4>Quick summary</h4>
          <p className="muted">Drop a scene synopsis here once dramaturgy is ready. For now this is a placeholder so everyone knows where the overview will live.</p>
        </section>

        <section className="scene-section">
          <h4>Cast on stage</h4>
          <div className="scene-cast-grid">
            {cast.map(entry => (
              <div key={`${entry.role}-${entry.actor}`} className="scene-cast-card">
                <div className="scene-cast-role">{entry.role}</div>
                <div className="scene-cast-actor">{entry.actor}</div>
                {entry.notes && <div className="scene-cast-notes">{entry.notes}</div>}
              </div>
            ))}
          </div>
        </section>

        <section className="scene-section">
          <h4>Cues involved</h4>
          {cuesToDisplay.length === 0 ? (
            <p className="muted">No cues detected yet.</p>
          ) : (
            <ul className="scene-cue-list">
              {cuesToDisplay.map(cue => (
                <li key={cue.cueId}>
                  <span className="scene-cue-number">{cue.cueNumber || cue.cueId}</span>
                  <span className="scene-cue-type">{cue.cueType.toUpperCase()}</span>
                  <span className="scene-cue-name">{cue.cueName || cue.text || 'Cue description coming soon'}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="scene-section">
          <h4>Connections & handoffs</h4>
          <p className="muted">Visual cue graphs will live here. For now use this space to note quick dependencies (e.g. “Q204 hands off to Q205 once actor exits”).</p>
        </section>
      </div>
    </div>
  );
};

export default ScenesOverviewMock;
