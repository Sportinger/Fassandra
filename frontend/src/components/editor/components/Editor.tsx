import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../AuthContext';
import { useEditorCore } from '../hooks/useEditorCore';
import { EditorUiProvider } from '../contexts/EditorUiContext';
import { EditorView } from './EditorView';
import { LoadingSpinner } from './ui/LoadingSpinner';
import type { EditorProps } from '../types';
import { Header } from '../../Header';
import { EditorShell } from './EditorShell';
import { useEditorSidebar } from '../contexts/EditorUiContext';

import '../styles/responsive.css';

type WorkspaceMode = 'editor' | 'calendar' | 'scenes';

export const Editor: React.FC<EditorProps> = ({
  scriptId,
  initialTitle,
  onNavigateBack,
}) => {
  const { token, user, tokenReady } = useAuth();
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('editor');

  const debugLog = useMemo(() => {
    return process.env.NODE_ENV === 'development' ? console.log : () => {};
  }, []);

  const {
    editor,
    ydoc,
    provider,
    connectionStatus,
    errorMessage,
    availableSpeakers,
    toolbarContext,
    showContextMenu,
    hideContextMenu,
    activeUserCount,
    isYjsSynced,
  } = useEditorCore({
    scriptId,
    user,
    hasToken: !!token,
  });

  const handleAnimatedNavigation = useCallback(() => {
    const pageElement = document.querySelector('.dinA4Page');
    if (pageElement) {
      pageElement.classList.add('exiting');
    }

    setTimeout(() => {
      onNavigateBack();
    }, 100);
  }, [onNavigateBack]);

  useEffect(() => {
    const handlePopState = (_event: PopStateEvent) => {
      handleAnimatedNavigation();
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [handleAnimatedNavigation]);

  if (!token || !user || !tokenReady) {
    return (
      <div className="editorContainer">
        <LoadingSpinner size="lg" />
        <p>Authenticating...</p>
      </div>
    );
  }

  if (connectionStatus === 'error' && errorMessage) {
    return (
      <div className="editorContainer">
        <div className="error-display">
          <h3>Connection Error</h3>
          <p>{errorMessage}</p>
          <button onClick={() => window.location.reload()}>Retry Connection</button>
        </div>
      </div>
    );
  }

  const headerNode = (
    <Header
      currentView="editor"
      scriptTitle={initialTitle}
      onNavigateToScripts={handleAnimatedNavigation}
      layouts={[]}
      currentLayout={null}
      onLayoutChange={() => {}}
      onCreateNewLayout={async () => {}}
      onSaveLayout={async () => {}}
      activeUserCount={activeUserCount}
      connectionStatus={connectionStatus}
    />
  );

  return (
    <EditorUiProvider
      editor={editor}
      provider={provider}
      scriptId={scriptId}
      token={token}
      availableSpeakers={availableSpeakers}
      debugLog={debugLog}
      showContextMenu={showContextMenu}
      hideContextMenu={hideContextMenu}
      isYjsSynced={isYjsSynced}
    >
      <EditorShell header={headerNode}>
        <WorkspaceModeTabs mode={workspaceMode} onChange={setWorkspaceMode} />

        <div className={`workspace-mode-content mode-${workspaceMode}`}>
          {workspaceMode === 'editor' ? (
            <EditorView
              editor={editor}
              provider={provider}
              ydoc={ydoc}
              connectionStatus={connectionStatus}
              toolbarContext={toolbarContext}
              debugLog={debugLog}
            />
          ) : workspaceMode === 'calendar' ? (
            <CalendarMock />
          ) : (
            <ScenesOverviewMock />
          )}
        </div>
      </EditorShell>
    </EditorUiProvider>
  );
};

type WorkspaceTabConfig = {
  mode: WorkspaceMode;
  label: string;
  description: string;
};

const TABS: WorkspaceTabConfig[] = [
  { mode: 'editor', label: 'Editor', description: 'Write & collaborate' },
  { mode: 'calendar', label: 'Calendar', description: 'Schedule + rehearsals' },
  { mode: 'scenes', label: 'Scenes', description: 'Cast & cue overview' },
];

const WorkspaceModeTabs: React.FC<{ mode: WorkspaceMode; onChange: (mode: WorkspaceMode) => void }> = ({ mode, onChange }) => {
  return (
    <div className="workspace-mode-tabs" role="tablist" aria-label="Workspace modes">
      {TABS.map(tab => (
        <button
          key={tab.mode}
          type="button"
          role="tab"
          aria-selected={mode === tab.mode}
          className={`workspace-mode-tab ${mode === tab.mode ? 'active' : ''}`}
          onClick={() => onChange(tab.mode)}
        >
          <span className="workspace-mode-tab-label">{tab.label}</span>
          <span className="workspace-mode-tab-description">{tab.description}</span>
        </button>
      ))}
    </div>
  );
};

const CALENDAR_EVENTS = [
  { id: 'evt-1', day: 'Mon 21', time: '10:00', title: 'Table read', location: 'Studio A', attendees: 'Full cast' },
  { id: 'evt-2', day: 'Mon 21', time: '14:00', title: 'Lighting review', location: 'Main stage', attendees: 'Tech crew' },
  { id: 'evt-3', day: 'Tue 22', time: '09:30', title: 'Scene 3 rehearsal', location: 'Studio B', attendees: 'Scene 3 cast' },
  { id: 'evt-4', day: 'Wed 23', time: '13:00', title: 'Cue-to-cue run', location: 'Main stage', attendees: 'Stage manager, crew' },
  { id: 'evt-5', day: 'Thu 24', time: '11:00', title: 'Choreography polish', location: 'Studio C', attendees: 'Dance ensemble' },
  { id: 'evt-6', day: 'Fri 25', time: '16:00', title: 'Designer check-in', location: 'Design office', attendees: 'Design team' },
];

const CalendarMock: React.FC = () => {
  const days = useMemo(() => Array.from(new Set(CALENDAR_EVENTS.map(event => event.day))), []);
  const [selectedDay, setSelectedDay] = useState<string>(days[0] ?? '');

  useEffect(() => {
    if (!selectedDay && days.length > 0) {
      setSelectedDay(days[0]);
    }
  }, [days, selectedDay]);

  const eventsForSelectedDay = useMemo(() => CALENDAR_EVENTS.filter(event => event.day === selectedDay), [selectedDay]);

  return (
    <div className="workspace-view calendar-view">
      <div className="calendar-grid">
        {days.map(day => {
          const dayEvents = CALENDAR_EVENTS.filter(event => event.day === day);
          const nextEvent = dayEvents[0];
          return (
            <button
              key={day}
              type="button"
              className={`calendar-day ${selectedDay === day ? 'active' : ''}`}
              onClick={() => setSelectedDay(day)}
            >
              <header>
                <span className="calendar-day-label">{day}</span>
                <span className="calendar-day-count">{dayEvents.length} events</span>
              </header>
              <div className="calendar-day-body">
                {nextEvent ? (
                  <>
                    <div className="calendar-day-time">{nextEvent.time}</div>
                    <div className="calendar-day-title">{nextEvent.title}</div>
                    <div className="calendar-day-meta">{nextEvent.location}</div>
                  </>
                ) : (
                  <div className="calendar-day-empty">No events scheduled</div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <aside className="calendar-detail">
        <header>
          <h3>{selectedDay || 'Pick a day'}</h3>
          <p>Quick glance at rehearsals, design reviews, and crew calls.</p>
        </header>

        <div className="calendar-detail-body">
          {eventsForSelectedDay.length === 0 ? (
            <div className="placeholder-card">
              <p>No events for this day yet.</p>
              <p className="muted">Drag scenes or cues here from the editor once scheduling is ready.</p>
            </div>
          ) : (
            eventsForSelectedDay.map(event => (
              <div key={event.id} className="calendar-detail-event">
                <div className="calendar-detail-time">{event.time}</div>
                <div>
                  <div className="calendar-detail-title">{event.title}</div>
                  <div className="calendar-detail-meta">{event.location}</div>
                  <div className="calendar-detail-attendees">{event.attendees}</div>
                </div>
              </div>
            ))
          )}
        </div>

        <button type="button" className="calendar-add-button">+ Add rehearsal block</button>
      </aside>
    </div>
  );
};

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

const ScenesOverviewMock: React.FC = () => {
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
