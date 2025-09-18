import React, { useMemo, useState, useEffect } from 'react';

const CALENDAR_EVENTS = [
  { id: 'evt-1', day: 'Mon 21', time: '10:00', title: 'Table read', location: 'Studio A', attendees: 'Full cast' },
  { id: 'evt-2', day: 'Mon 21', time: '14:00', title: 'Lighting review', location: 'Main stage', attendees: 'Tech crew' },
  { id: 'evt-3', day: 'Tue 22', time: '09:30', title: 'Scene 3 rehearsal', location: 'Studio B', attendees: 'Scene 3 cast' },
  { id: 'evt-4', day: 'Wed 23', time: '13:00', title: 'Cue-to-cue run', location: 'Main stage', attendees: 'Stage manager, crew' },
  { id: 'evt-5', day: 'Thu 24', time: '11:00', title: 'Choreography polish', location: 'Studio C', attendees: 'Dance ensemble' },
  { id: 'evt-6', day: 'Fri 25', time: '16:00', title: 'Designer check-in', location: 'Design office', attendees: 'Design team' },
];

export const CalendarMock: React.FC = () => {
  const days = useMemo(() => Array.from(new Set(CALENDAR_EVENTS.map(event => event.day))), []);
  const [selectedDay, setSelectedDay] = useState<string>(days[0] ?? '');

  useEffect(() => {
    if (!selectedDay && days.length > 0) {
      setSelectedDay(days[0]);
    }
  }, [days, selectedDay]);

  const eventsForSelectedDay = useMemo(
    () => CALENDAR_EVENTS.filter(event => event.day === selectedDay),
    [selectedDay]
  );

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

export default CalendarMock;
