import React, { useCallback, useEffect, useRef, useState } from 'react';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Offcanvas from 'react-bootstrap/Offcanvas';
import Spinner from 'react-bootstrap/Spinner';
import { FormattedMessage, useIntl } from 'react-intl';
import { useLocation } from 'react-router-dom';

import { useSelectedProject } from 'contexts/ProjectContext';
import { chatProjectDocuments } from 'utils/apiServices';

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/** Same coverage as AdminLayout `projectDetailRoutes` (orchestration detail URLs included). */
const PROJECT_ROUTE_PREFIXES = [
  '/projects/dashboard',
  '/projects/details',
  '/projects/orchestrations',
  '/projects/testcases',
  '/projects/requirements',
  '/projects/test-scenarios',
  '/projects/documents',
  '/projects/risks',
  '/projects/defects',
  '/projects/execution',
  '/projects/test-recorder',
  '/projects/test-agents',
  '/projects/traceability'
];

function isProjectShellPath(pathname) {
  return PROJECT_ROUTE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function answerModeMessageId(mode) {
  switch (mode) {
    case 'llm':
      return 'project-doc-chat-mode-llm';
    case 'extractive':
      return 'project-doc-chat-mode-extractive';
    case 'extractive_fallback':
      return 'project-doc-chat-mode-extractive-fallback';
    case 'extractive_fallback_node':
      return 'project-doc-chat-mode-node-fallback';
    default:
      return 'project-doc-chat-mode-unknown';
  }
}

export default function ProjectDocumentChatPanel() {
  const intl = useIntl();
  const location = useLocation();
  const { selectedProjectInContext: project } = useSelectedProject();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const scrollRef = useRef(null);

  const inProjectView = !!(project?.project_id && isProjectShellPath(location.pathname));

  useEffect(() => {
    setMessages([]);
  }, [project?.project_id]);

  useEffect(() => {
    if (!inProjectView) setOpen(false);
  }, [inProjectView]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || loading || !project?.project_id) return;

    setInput('');
    const userTurn = { role: 'user', content: text, id: uid() };
    const pendingId = uid();
    const conversationHistory = messages.map(({ role, content }) => ({ role, content }));

    setMessages((prev) => [
      ...prev,
      userTurn,
      {
        role: 'assistant',
        content: '',
        id: pendingId,
        citations: [],
        pending: true
      }
    ]);
    setLoading(true);

    try {
      const response = await chatProjectDocuments({
        projectId: project.project_id,
        organizationId: project.organization_id,
        query: text,
        conversationHistory
      });

      const data = response.data || {};
      const answer = typeof data.answer === 'string' ? data.answer : '';
      const citations = Array.isArray(data.citations) ? data.citations : [];
      const sources = data.sources && typeof data.sources === 'object' ? data.sources : {};
      const answerMode =
        typeof sources.answer_mode === 'string' ? sources.answer_mode : null;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId
            ? {
                ...m,
                content: answer || '—',
                citations,
                answerMode,
                pending: false
              }
            : m
        )
      );
    } catch (e) {
      console.error('project document chat:', e);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId
            ? {
                ...m,
                content: '',
                pending: false,
                failed: true
              }
            : m
        )
      );
    } finally {
      setLoading(false);
    }
  }, [input, loading, project, messages]);

  if (!inProjectView) return null;

  return (
    <>
      <Button
        type="button"
        variant="primary"
        className="rounded-circle shadow"
        style={{
          position: 'fixed',
          bottom: '1.5rem',
          right: '1.5rem',
          zIndex: 1040,
          width: '3.25rem',
          height: '3.25rem',
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        aria-label={intl.formatMessage({ id: 'project-doc-chat-open' })}
        onClick={() => setOpen(true)}
      >
        <i className="feather icon-message-circle" style={{ fontSize: '1.35rem' }} />
      </Button>

      <Offcanvas show={open} onHide={() => setOpen(false)} placement="end" style={{ width: 'min(440px, 100vw)' }}>
        <Offcanvas.Header closeButton>
          <Offcanvas.Title>
            <FormattedMessage id="project-doc-chat-title" />
          </Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body className="d-flex flex-column pt-0" style={{ maxHeight: 'calc(100vh - 56px)' }}>
          <p className="text-muted small mb-2">
            <FormattedMessage id="project-doc-chat-subtitle" />
          </p>

          <div
            ref={scrollRef}
            className="flex-grow-1 overflow-auto border rounded p-2 mb-2 bg-light"
            style={{ minHeight: '200px', maxHeight: '55vh' }}
          >
            {messages.length === 0 && (
              <div className="text-muted small text-center py-4">
                <FormattedMessage id="project-doc-chat-hint" />
              </div>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={`mb-3 ${m.role === 'user' ? 'text-end' : 'text-start'}`}
              >
                <div
                  className={`d-inline-block px-3 py-2 rounded-3 text-start ${
                    m.role === 'user' ? 'bg-primary text-white' : 'bg-white border'
                  }`}
                  style={{ maxWidth: '100%', whiteSpace: 'pre-wrap' }}
                >
                  {m.pending ? (
                    <Spinner animation="border" size="sm" />
                  ) : m.failed ? (
                    <FormattedMessage id="project-doc-chat-error" />
                  ) : (
                    m.content
                  )}
                </div>
                {m.role === 'assistant' && !m.pending && !m.failed && (
                  <div className="mt-1 small">
                    <span
                      className={`badge ${
                        m.answerMode === 'llm'
                          ? 'bg-success bg-opacity-10 text-success border border-success'
                          : 'bg-secondary bg-opacity-10 text-secondary border'
                      }`}
                    >
                      <FormattedMessage id={answerModeMessageId(m.answerMode)} />
                    </span>
                  </div>
                )}
                {m.role === 'assistant' && m.citations?.length > 0 && !m.pending && !m.failed && (
                  <div className="mt-1 small text-muted">
                    <span className="fw-semibold me-1">
                      <FormattedMessage id="project-doc-chat-sources" />:
                    </span>
                    {m.citations.slice(0, 6).map((c, i) => (
                      <span key={i} className="d-block">
                        {c.title || 'Document'}
                        {c.section_path ? ` — ${c.section_path}` : ''}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <Form
            className="d-flex gap-2 align-items-start"
            onSubmit={(ev) => {
              ev.preventDefault();
              handleSend();
            }}
          >
            <Form.Control
              as="textarea"
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={intl.formatMessage({ id: 'project-doc-chat-placeholder' })}
              disabled={loading}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <Button type="submit" variant="primary" disabled={loading || !input.trim()} className="text-nowrap">
              {loading ? <Spinner size="sm" animation="border" /> : <FormattedMessage id="project-doc-chat-send" />}
            </Button>
          </Form>
        </Offcanvas.Body>
      </Offcanvas>
    </>
  );
}
