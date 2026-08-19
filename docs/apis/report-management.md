# Report Management API

**Base URL:** configured `config.url` (default local port **8089**).

Mounts are defined in `apis/report_management/index.js`.

## OpenAPI / Swagger

- **UI:** `{baseUrl}/api-docs` (e.g. `http://localhost:8089/api-docs`).
- **Spec (JSON / YAML):** `{baseUrl}/api-docs/json`, `{baseUrl}/api-docs/yaml`.
- **In repo:** `apis/report_management/swagger/openapi-spec.js`; plugins registered from `index.js`. Multipart design-template uploads use `middlewares/fastify-design-template-upload.js` (replacing multer). Controllers run via `helpers/express-compat.js`.

## Root

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/` | Service label |

## Design templates — prefix `/design_templates`

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/design_templates` | List |
| `GET` | `/design_templates/:designTemplateId` | Get |
| `POST` | `/design_templates` | Create (multipart / file-upload middleware) |
| `DELETE` | `/design_templates/:designTemplateId` | Delete |

## Report sections — prefix `/report_sections`

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/report_sections` | List |
| `GET` | `/report_sections/:reportSectionId` | Get |
| `POST` | `/report_sections` | Add |
| `POST` | `/report_sections/add_default` | Add defaults |
| `POST` | `/report_sections/:reportSectionId` | Update |
| `DELETE` | `/report_sections/:reportSectionId` | Delete |

## Report templates — prefix `/report_templates`

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/report_templates` | List |
| `GET` | `/report_templates/:reportTemplateId` | Get |
| `POST` | `/report_templates/:reportTemplateId/set_default` | Set default |
| `POST` | `/report_templates` | Create |
| `POST` | `/report_templates/:reportTemplateId` | Update |
| `DELETE` | `/report_templates/:reportTemplateId` | Delete |

## Reports — prefix `/reports`

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/reports/generate` | Generate |
| `GET` | `/reports/download` | Download |
| `POST` | `/reports/preview` | Preview |
| `GET` | `/reports/wordtoword` | Word-to-word conversion |

## Source files

`apis/report_management/routes/design-template-routes.js`, `report-section-routes.js`, `report-template-routes.js`, `report-routes.js`, `main-routes.js`.
