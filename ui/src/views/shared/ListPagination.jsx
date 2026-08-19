import React from 'react';
import { Pagination, Row, Col, Form } from 'react-bootstrap';

/**
 * Footer for inventory lists: page size selector + Prev/Next (and ellipsis when many pages).
 * Expects `pagination` shape from GM APIs: { totalItems, totalPages, currentPage, pageSize }.
 */
export default function ListPagination({
  pagination,
  disabled,
  onPageChange,
  pageSize,
  pageSizeOptions = [10, 25, 50],
  onPageSizeChange,
  className = 'mt-3'
}) {
  const total = Number(pagination?.totalItems);
  const totalPages = Number(pagination?.totalPages);
  const currentPage = Number(pagination?.currentPage) || 1;
  const size = Number(pageSize || pagination?.pageSize) || 25;

  if (!pagination || Number.isNaN(total) || total <= 0) {
    return null;
  }

  const first = Math.min(total, (currentPage - 1) * size + 1);
  const last = Math.min(total, currentPage * size);

  const maxButtons = 5;
  let start = Math.max(1, currentPage - Math.floor(maxButtons / 2));
  let end = Math.min(totalPages || 1, start + maxButtons - 1);
  if (end - start < maxButtons - 1) {
    start = Math.max(1, end - maxButtons + 1);
  }
  const pageItems = [];
  for (let p = start; p <= end; p += 1) pageItems.push(p);

  return (
    <Row className={`align-items-center gy-2 ${className}`}>
      <Col xs={12} md="auto" className="text-muted small">
        Showing <strong>{first}</strong>&ndash;<strong>{last}</strong> of <strong>{total}</strong>
      </Col>
      {onPageSizeChange && (
        <Col xs={12} md="auto" className="d-flex align-items-center gap-2">
          <Form.Label className="mb-0 small text-muted">Rows</Form.Label>
          <Form.Select
            size="sm"
            style={{ width: 76 }}
            value={size}
            disabled={disabled}
            onChange={(e) =>
              onPageSizeChange(Number(e.target.value) || 25)
            }
          >
            {pageSizeOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Form.Select>
        </Col>
      )}
      <Col xs={12} md className="d-flex justify-content-md-end justify-content-start">
        {(totalPages || 1) > 1 && (
          <Pagination className="mb-0 flex-wrap">
            <Pagination.First
              disabled={disabled || currentPage <= 1}
              onClick={() => onPageChange(1)}
            />
            <Pagination.Prev
              disabled={disabled || currentPage <= 1}
              onClick={() => onPageChange(currentPage - 1)}
            />
            {start > 1 && (
              <>
                <Pagination.Item disabled={disabled} onClick={() => onPageChange(1)}>
                  1
                </Pagination.Item>
                {start > 2 && <Pagination.Ellipsis disabled />}
              </>
            )}
            {pageItems.map((p) => (
              <Pagination.Item
                key={p}
                active={p === currentPage}
                disabled={disabled}
                onClick={() => onPageChange(p)}
              >
                {p}
              </Pagination.Item>
            ))}
            {end < totalPages && (
              <>
                {end < totalPages - 1 && <Pagination.Ellipsis disabled />}
                <Pagination.Item
                  disabled={disabled}
                  onClick={() => onPageChange(totalPages)}
                >
                  {totalPages}
                </Pagination.Item>
              </>
            )}
            <Pagination.Next
              disabled={disabled || currentPage >= totalPages}
              onClick={() => onPageChange(currentPage + 1)}
            />
            <Pagination.Last
              disabled={disabled || currentPage >= totalPages}
              onClick={() => onPageChange(totalPages)}
            />
          </Pagination>
        )}
      </Col>
    </Row>
  );
}
