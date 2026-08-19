from test_agent.utility.messaging_service.rabbit_mq import RabbitMQ


class MessagingService:
    """A wrapper class for interacting with a messaging service.

    Args:
        msg_type (str): Type of messaging service class to use.
        host (str): Hostname of the messaging service.
        port (int): Port number of the messaging service.
        username (str, optional): Username for authentication (default: None).
        password (str, optional): Password for authentication (default: None).
        vhost (str, optional): Virtual host if any (default: None).
    """

    def __init__(self, msg_type, host, port, username=None, password=None, vhost=None):
        msg_class = globals()[msg_type]
        self.msg_module = msg_class(host, port, username, password)

    def disconnect(self):
        """
        Wrapper for disconnect method of the messaging service.
        """
        self.msg_module.disconnect()

    def publish_message(self, exchange, routing_key, body, properties=None):
        """
        Wrapper for publish_message method of the messaging service.
        """
        self.msg_module.publish_message(exchange, routing_key, body, properties)

    def exchange_declare(self, exchange, exchange_type):
        """
        Wrapper for exchange_declare method of the messaging service.
        """
        self.msg_module.exchange_declare(exchange, exchange_type)

    def queue_declare(self, queue, exclusive=False):
        """
        Wrapper for queue_declare method of the messaging service.
        """
        return self.msg_module.queue_declare(queue, exclusive)

    def queue_bind(self, exchange, queue, routing_key):
        """
        Wrapper for queue_bind method of the messaging service.
        """
        self.msg_module.queue_bind(exchange, queue, routing_key)

    def basic_consume(self, queue, callback, auto_ack=True):
        """
        Wrapper for basic_consume method of the messaging service.
        """
        self.msg_module.basic_consume(queue, callback, auto_ack)

    def start_consuming(self):
        """
        Wrapper for start_consuming method of the messaging service.
        """
        self.msg_module.start_consuming()

    def set_properties(self, headers=None):
        """
        Wrapper for set_properties method of the messaging service.
        """
        return self.msg_module.set_properties(headers)

    def stop_consuming(self):
        """
        Wrapper for stop_consuming method of the messaging service.
        """
        self.msg_module.stop_consuming()

    def process_data_events(self, time_limit=None):
        """
        Wrapper for process_data_events method of the messaging service.
        """
        self.msg_module.process_data_events(time_limit)
