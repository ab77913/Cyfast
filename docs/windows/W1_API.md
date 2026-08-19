# W1 API
All paths are under `/services/general-management` and require the corresponding Windows permission.

- `POST /agent_enrollments` creates a one-time enrollment token.
- `GET /windows_nodes`, `GET /windows_nodes/:id`, and `GET /windows_nodes/:id/capabilities` display node state.
- `POST /windows_nodes/:id/sessions` creates a project/profile-scoped session.
- `GET /windows_sessions/:id` and `GET /windows_sessions/:id/evidence` read state/evidence.
- `POST /windows_sessions/:id/{launch,attach,inspect,actions,screenshots,end}` queues allowed commands.
- `GET|POST|PUT|DELETE /windows_application_profiles` manages approved profiles.
- `GET /windows_evidence/:id/content` downloads authorized evidence.

Errors have `{ code, message }`; clients must display only these fields. `503 FEATURE_DISABLED` means the service feature flag is off. Command requests return `202` because execution is asynchronous.
