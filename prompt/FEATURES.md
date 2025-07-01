# Feature Checklist

Use this checklist to track the progress of the core features described in the vision document (see `initial chat.pdf`). Mark items with `[x]` once they are implemented and tested.

## 1. Real-time collaborative script editing
- [ ] Multi-user text editing with operational transforms / CRDT
- [ ] Live cursor & selection sharing
- [ ] Commenting and suggestion mode
- [ ] Offline editing with conflict-free sync after reconnect
- [ ] Version history & change tracking

## 2. Automatic speech detection ("Mitlesen")
- [ ] Microphone input capture during rehearsal
- [ ] Speech-to-text transcription
- [ ] Alignment of spoken text with script
- [ ] Auto-scroll to current position in script view
- [ ] Exportable transcript of rehearsal

## 3. Department-specific cues & notes
- [ ] Cue lists for lighting
- [ ] Cue lists for sound
- [ ] Cue lists for video/projection
- [ ] Attachment of notes (images, PDFs, links) to scenes or lines
- [ ] Role-based visibility & permissions for departmental data

## 4. EU-compliant security & offline-first architecture
- [ ] Hosting on EU servers / self-hosting option
- [ ] End-to-end encryption of project data
- [ ] Two-factor authentication (2FA)
- [ ] Selective offline caching of projects
- [ ] Differential sync (push/pull only changes)

## 5. Cross-platform clients
- [ ] Web client (desktop & mobile)
- [ ] Native desktop application (Tauri)
- [ ] Mobile app (optional, future)

## 6. Infrastructure & DevOps
- [ ] Automated CI/CD pipeline
- [ ] Docker containers for services
- [ ] Database migrations & seeding
- [ ] Monitoring & logging (Prometheus/Grafana)

## 7. Documentation & Community
- [ ] Developer setup guide in README
- [ ] API documentation (OpenAPI / gRPC)
- [ ] User manual & onboarding material
- [ ] Contribution guidelines & code of conduct 