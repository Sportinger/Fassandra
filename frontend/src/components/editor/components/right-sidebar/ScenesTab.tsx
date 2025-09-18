import React from 'react';
import type { SidebarScene } from '../../hooks/useSidebarData';

interface ScenesTabProps {
  scenes: SidebarScene[];
  activeSceneId: string | null;
  onSelect: (scene: SidebarScene) => void;
}

export const ScenesTab: React.FC<ScenesTabProps> = ({ scenes, activeSceneId, onSelect }) => (
  <div className="rs-tabpanel" role="tabpanel" id="rs-panel-scenes" aria-labelledby="rs-tab-scenes">
    <div className="rs-list">
      {scenes.map(scene => (
        <div
          key={scene.id}
          className={`rs-card clickable ${activeSceneId === scene.id ? 'active' : ''}`}
          onClick={() => onSelect(scene)}
        >
          <div className="rs-scene-row">
            <span className="rs-scene-number">Szene {scene.sceneNumber}</span>
            <span className="rs-scene-name">{scene.sceneName}</span>
          </div>
        </div>
      ))}
      {scenes.length === 0 && <div className="rs-empty">No scenes in this script yet.</div>}
    </div>
  </div>
);

export default ScenesTab;
