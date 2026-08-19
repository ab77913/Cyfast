import json
import time
import sched
from test_agent.utility.service_initializer import ServiceInitializer
from test_agent.common.test_agent_dto import AgentInfo


class HeartbeatManager:
    """
    Manages the sending of heartbeat messages to a message queue at regular intervals.
    """

    def __init__(self, agent_closure_event=None):
        """
        Initializes the HeartbeatManager, sets up the message queue, and initializes the scheduler.
        """
        self.service_initializer = ServiceInitializer()
        self._msg_obj = self.service_initializer.set_up_message_queue()
        self._msg_obj.exchange_declare(
            exchange="heartbeat_exchange", exchange_type="topic"
        )
        self.scheduler = sched.scheduler(time.time, time.sleep)
        self.last_status_sent_time = time.time()
        self.agent_closure_event = agent_closure_event

    def heartbeat(self):
        """
        Starts the heartbeat sender, which begins scheduling the heartbeat messages.
        """
        print("Heartbeat sender started ")
        self.scheduler.enter(0, 1, self.send_message)
        self.scheduler.run()

    def send_message(self):
        """
        Sends a heartbeat message to the message queue. If more than 10 seconds have passed since the last status message,
        it includes the status and mode of the agent. Schedules the next heartbeat message.
        """
        data = {"agent_id": AgentInfo().uuid, "heartbeat_time": time.time()}
        data["status"] = AgentInfo().status
        self._msg_obj.publish_message(
            "heartbeat_exchange", AgentInfo().uuid + ".ack", json.dumps(data)
        )
        # Schedule the next heartbeat only if the closure event is not set
        if not self.agent_closure_event.is_set():
            self.scheduler.enter(2, 1, self.send_message)
