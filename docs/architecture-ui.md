# Web UI — architecture

**Path:** `ui/`  
**Runtime:** **Vite** dev server / static build; **React 18**  
**Role:** Operator dashboard for CyFAST: projects, orchestrations, test cases, agents, reports, user administration, and **Gen AI V&V** screens (project documents, requirement generation/approval, test scenario generation). Backend behavior is documented in [AI-assisted generation](architecture-ai-generation.md); this file covers only the SPA.

## Stack

- **Bundler:** Vite with `@vitejs/plugin-react`.
- **UI:** React 18, **React Bootstrap** / **Bootstrap 5**, **Sass**, charts (**ApexCharts**, **Chart.js**), forms (**Formik**), rich text (**CKEditor**, **Jodit**), calendars (**FullCalendar**), tables and widgets from the Gradient Able–style template.
- **HTTP:** **axios**; separate instances for different backends (see `src/utils/cyfastAxios`, `cylogAxios`, `cyuserAxios`).
- **Auth:** **JWT** handling via `jsonwebtoken` / `jwt-decode`; **Auth0 SPA SDK** is present for optional Auth0 flows.

## API integration

Central API wrappers live in **`src/utils/apiServices.jsx`**, which imports:

- **`cyfastAxios`** — General Management: `/projects`, `/project_documents`, `/requirement_generation`, `/test_scenario_generation`, `/test_scenarios`, `/generation_validation`, `/user_notifications`, orchestration and test routes, etc. (see `src/utils/apiServices.jsx`).
- **`cylogAxios`** — Logger service under `/logs/...`.
- **`cyuserAxios`** — User Management: `/auth`, `/users`, `/roles`, `/permissions`.

Environment-specific base URLs are supplied through Vite **`import.meta.env`** (see `.env` / `.env.qa` patterns and `package.json` scripts such as `build-stage`).

## Source layout (high level)

| Area | Typical contents |
|------|------------------|
| `src/views/` | Page-level screens (projects, orchestrations, test cases, reports, admin). |
| `src/components/` | Reusable UI pieces. |
| `src/utils/` | Axios clients, API services, helpers. |
| `src/assets/scss/` | Theme and CyFAST-specific styles. |
| `src/routes/` | React Router configuration. |

## Build and run

- **Development:** `yarn start` or `npm start` → Vite on default dev port.
- **Production build:** `yarn build` / `npm run build`; **`build-stage`** uses `env-cmd` with `.env.qa` for staged API endpoints.

## Relationship to backends

The UI does not embed business rules for orchestration or reporting; it is a **client** of the APIs documented in the other `docs/architecture-*.md` files. CORS on the APIs is currently permissive (`*`) for development — tighten per deployment policy.
