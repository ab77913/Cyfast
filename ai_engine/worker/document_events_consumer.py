"""
Optional RabbitMQ consumer: same event as HTTP `/internal/documents/indexed`.

Run (after setting env + venv):
  python -m worker.document_events_consumer

Uses queue name from env RABBITMQ_AI_QUEUE (default: ai_rag_document_indexed).
"""

from __future__ import annotations

import json
import os
import sys

from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

import pika

QUEUE = os.getenv("RABBITMQ_AI_QUEUE", "ai_rag_document_indexed")


def normalize_amqp_url_for_pika(url: str) -> str:
    """
    Align Node/amqplib URLs with Pika:
    - frameMax → frame_max
    - frame_max=0 is dropped (Node often uses 0 for "broker default"; Pika rejects 0 — min frame size is 4096).
    """
    parsed = urlparse(url.strip())
    pairs = []
    for k, v in parse_qsl(parsed.query, keep_blank_values=True):
        key = "frame_max" if k.lower() in ("framemax", "frame_max") else k
        if key == "frame_max" and str(v).strip() in ("0", ""):
            continue
        pairs.append((key, v))
    new_query = urlencode(pairs)
    return urlunparse((parsed.scheme, parsed.netloc, parsed.path, parsed.params, new_query, parsed.fragment))


RMQ_URL = normalize_amqp_url_for_pika(
    os.getenv(
        "RABBITMQ_URL",
        "amqp://guest:guest@localhost:5672/",
    )
)


def main() -> None:
    connection = pika.BlockingConnection(pika.URLParameters(RMQ_URL))
    channel = connection.channel()
    channel.queue_declare(queue=QUEUE, durable=False)

    def callback(_ch, method, _properties, body):
        try:
            payload = json.loads(body.decode("utf-8"))
            print(f"[ai_engine worker] DOCUMENT_INDEXED: {payload}", flush=True)
            # Future: call enrichment pipeline, invalidate cache, etc.
        except Exception as e:
            print(f"[ai_engine worker] error: {e}", file=sys.stderr, flush=True)
        finally:
            _ch.basic_ack(delivery_tag=method.delivery_tag)

    channel.basic_qos(prefetch_count=1)
    channel.basic_consume(queue=QUEUE, on_message_callback=callback)
    print(f"Listening on {QUEUE} …", flush=True)
    channel.start_consuming()


if __name__ == "__main__":
    main()
