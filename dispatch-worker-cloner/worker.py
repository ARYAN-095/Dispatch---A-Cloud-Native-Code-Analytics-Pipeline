# worker.py - The first version of our Python worker

import pika
import time
import json

# RabbitMQ connection details
RABBITMQ_URL = 'amqp://guest:guest@localhost:5672/'
QUEUE_NAME = 'analysis_jobs'

def main():
    """Main function to connect to RabbitMQ and start consuming messages."""
    
    connection = None
    while not connection:
        try:
            # Establish a connection to the RabbitMQ server
            connection = pika.BlockingConnection(pika.URLParameters(RABBITMQ_URL))
            print("Successfully connected to RabbitMQ")
        except pika.exceptions.AMQPConnectionError:
            print("Failed to connect to RabbitMQ. Retrying in 5 seconds...")
            time.sleep(5)

    channel = connection.channel()

    # Declare the queue again to ensure it exists. This is idempotent.
    channel.queue_declare(queue=QUEUE_NAME, durable=True)

    print(' [*] Waiting for messages. To exit press CTRL+C')

    # This function will be called whenever a message is received.
    def callback(ch, method, properties, body):
        """Processes a message received from the queue."""
        
        print(f" [x] Received message with delivery tag {method.delivery_tag}")
        
        # Decode the message body from bytes to a string
        job_payload_str = body.decode()
        
        # Parse the JSON string into a Python dictionary
        job_payload = json.loads(job_payload_str)
        
        print(f" [->] Processing job for user '{job_payload['userId']}' on repo '{job_payload['repoUrl']}'")
        
        # --- IMPORTANT ---
        # Acknowledge the message. This tells RabbitMQ that we have successfully
        # processed the message and it can be safely deleted from the queue.
        # If the worker crashes before this line, RabbitMQ will re-queue the message
        # for another worker to process. This ensures reliability.
        ch.basic_ack(delivery_tag=method.delivery_tag)
        
        print(f" [✓] Done processing message {method.delivery_tag}. Acknowledged.")

    # Tell RabbitMQ that this callback function should receive messages from our queue
    channel.basic_consume(queue=QUEUE_NAME, on_message_callback=callback)

    # Start listening for messages. This is a blocking call.
    channel.start_consuming()

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print('Interrupted')
        # Gracefully close the connection
        if 'connection' in locals() and connection.is_open:
            connection.close()