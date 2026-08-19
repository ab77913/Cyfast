import pika
import time


class RabbitMQ:
    """
    A class for Rabbit MQ messaging implementation.

    Args:
        host (str): The RabbitMQ host address.
        port (int): The RabbitMQ port number.
        username (str, optional): Username for authentication. Defaults to None.
        password (str, optional): Password for authentication. Defaults to None.
    """

    MAX_PUBLISH_RETRIES = 3
    MAX_CONSUME_RETRIES = 3

    def __init__(self, host, port, username=None, password=None):
        self.host = host
        self.port = port
        self._is_consuming = False
        self.connect()

    def connect(self):
        """
        Establishes a connection to RabbitMQ server.
        """
        self._connection = pika.BlockingConnection(
            pika.ConnectionParameters(self.host, self.port)
        )
        self._channel = self._connection.channel()

    def disconnect(self):
        """
        Disconnects from RabbitMQ server.
        """
        if self._is_consuming:
            self.stop_consuming()

    def close_connection(self):
        """
        Closes the connection to RabbitMQ server.
        """
        self._is_consuming = False
        try:
            if not self._connection.is_closed:
                self._connection.close()
        except Exception as e:
            print(f"Error occurred while closing connection: {e}")

    def close_channel(self):
        """
        Closes the channel to RabbitMQ server.
        """
        try:
            if not self._channel.is_closed:
                self._channel.close()
        except Exception as e:
            print(f"Error occurred while closing channel: {e}")

    def publish_message(self, exchange, routing_key, body, properties=None):
        """
        Publishes a message to RabbitMQ.

        Args:
            exchange (str): The exchange to publish to.
            routing_key (str): The routing key for the message.
            body (str): The message body.
            properties (pika.BasicProperties, optional): Additional properties for the message.

        Raises:
            pika.exceptions.AMQPError: If an error occurs during publishing.

        """
        retries = 0
        while retries < self.MAX_PUBLISH_RETRIES:
            try:
                self._channel.basic_publish(
                    exchange=exchange,
                    routing_key=routing_key,
                    body=body,
                    properties=properties,
                )
                return
            except pika.exceptions.AMQPError as e:
                print(f"Error publishing message on {exchange}:{routing_key}: {e}")
                retries += 1
                self.connect()
                if retries == self.MAX_PUBLISH_RETRIES:
                    print(
                        f"Max retries reached. Unable to publish message on {exchange}:{routing_key}"
                    )
                    raise
                print(
                    f"Retrying in 1 second... (Attempt {retries}/{self.MAX_PUBLISH_RETRIES})"
                )
                time.sleep(1)

    def exchange_declare(self, exchange, exchange_type):
        """
        Declares a RabbitMQ exchange.

        Args:
            exchange (str): The exchange name.
            exchange_type (str): The type of exchange ('direct', 'fanout', etc.).
        """
        self._channel.exchange_declare(exchange=exchange, exchange_type=exchange_type)

    def queue_declare(self, queue, exclusive=False):
        """
        Declares a RabbitMQ queue.

        Args:
            queue (str): The queue name.
            exclusive (bool, optional): Whether the queue is exclusive. Defaults to False.

        Returns:
            pika.spec.Queue.DeclareOk: The result of the queue declare operation.
        """
        return self._channel.queue_declare(queue=queue, exclusive=exclusive)

    def queue_bind(self, exchange, queue, routing_key):
        """
        Binds a queue to an exchange with a routing key.

        Args:
            exchange (str): The exchange name.
            queue (str): The queue name.
            routing_key (str): The routing key.

        """
        self._channel.queue_bind(
            exchange=exchange, queue=queue, routing_key=routing_key
        )

    def basic_consume(self, queue, callback, auto_ack=True):
        """
        Starts consuming messages from a queue.

        Args:
            queue (str): The queue name.
            callback (callable): The callback function to handle incoming messages.
            auto_ack (bool, optional): Whether messages should be automatically acknowledged. Defaults to True.
        """
        self._channel.basic_consume(
            queue=queue, on_message_callback=callback, auto_ack=auto_ack
        )

    def start_consuming(self):
        """
        Starts consuming messages from RabbitMQ.

        Raises:
            pika.exceptions.AMQPError: If an error occurs while consuming messages.
        """
        retries = 0
        while retries < self.MAX_CONSUME_RETRIES:
            try:
                self._is_consuming = True
                self._channel.start_consuming()

            except pika.exceptions.AMQPError as e:
                print(f"Error consuming messages {e}")
                self._is_consuming = False
                retries += 1
                self.connect()
                if retries == self.MAX_CONSUME_RETRIES:
                    print("Max retries reached. Unable to consume messages")
                    raise
                print(
                    f"Retrying in 1 second... (Attempt {retries}/{self.MAX_CONSUME_RETRIES})"
                )
                time.sleep(1)

    def set_properties(self, headers=None):
        """
        Sets custom properties for RabbitMQ messages.

        Args:
            headers (dict, optional): Custom headers for the message.

        Returns:
            pika.BasicProperties: The properties object with headers set, if provided.
        """
        properties = pika.BasicProperties()
        if headers:
            properties.headers = headers
        return properties

    def stop_consuming(self):
        """
        Stops consuming messages from RabbitMQ.
        """
        try:
            if self._channel and self._connection and self._is_consuming:
                self._channel.stop_consuming()
        except Exception as e:
            print(f"Error occurred while closing connection: {e}")

    def process_data_events(self, time_limit=None):
        """
        Processes data events for RabbitMQ.
        """
        try:
            if self._channel and self._connection:
                self._connection.process_data_events(time_limit=time_limit)
        except Exception as e:
            print(f"Error occurred while processing data events: {e}")
