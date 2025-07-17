# worker.py - Worker that consumes jobs and writes to Firestore

import pika
import time
import json
import os
import firebase_admin
from firebase_admin import credentials, firestore

# --- Firebase Admin SDK Initialization ---

# Path to your service account key file.
# It's good practice to use an environment variable for this.
SERVICE_ACCOUNT_KEY_PATH = os.environ.get(
    'SERVICE_ACCOUNT_KEY_PATH', 
    'serviceAccountKey.json'
)

try:
    cred = credentials.Certificate(SERVICE_ACCOUNT_KEY_PATH)
    firebase_admin.initialize_app(cred)
    print("Successfully initialized Firebase Admin SDK")
except Exception as e:
    print(f"Error initializing Firebase Admin SDK: {e}")
    print("Please ensure 'serviceAccountKey.json' is in the correct path and valid.")
    exit(1)

# Get a client to interact with Firestore
db = firestore.client()
print("Firestore client created")


# --- RabbitMQ Connection Details ---
RABBITMQ_URL = 'amqp://guest:guest@localhost:5672/'
QUEUE_NAME = 'analysis_jobs'


def main():
    """Main function to connect to RabbitMQ and start consuming messages."""
    
    connection = None
    while not connection:
        try:
            connection = pika.BlockingConnection(pika.URLParameters(RABBITMQ_URL))
            print("Successfully connected to RabbitMQ")
        except pika.exceptions.AMQPConnectionError:
            print("Failed to connect to RabbitMQ. Retrying in 5 seconds...")
            time.sleep(5)

    channel = connection.channel()
    channel.queue_declare(queue=QUEUE_NAME, durable=True)
    print(' [*] Waiting for messages. To exit press CTRL+C')

    def callback(ch, method, properties, body):
        """Processes a message: creates a job document in Firestore."""
        
        print(f" [x] Received message with delivery tag {method.delivery_tag}")
        
        try:
            job_payload = json.loads(body.decode())
            repo_url = job_payload['repoUrl']
            user_id = job_payload['userId']
            
            print(f" [->] Creating Firestore document for job on repo '{repo_url}'")

            # --- Firestore Interaction ---
            # Create a new document in the 'jobs' collection
            job_data = {
                'userId': user_id,
                'repoUrl': repo_url,
                'status': 'Queued',
                'createdAt': firestore.SERVER_TIMESTAMP, # Use server's timestamp
                'updatedAt': firestore.SERVER_TIMESTAMP,
                'report': None # Placeholder for the final report
            }
            
            # Add the new document to the 'jobs' collection. Firestore will auto-generate an ID.
            doc_ref = db.collection('jobs').add(job_data)
            
            print(f" [✓] Successfully created Firestore document with ID: {doc_ref[1].id}")

            # Acknowledge the message to remove it from the queue
            ch.basic_ack(delivery_tag=method.delivery_tag)
            print(f" [✓] Acknowledged message {method.delivery_tag}.")

        except Exception as e:
            print(f" [!] Error processing message: {e}")
            # Here you might want to decide if you should reject the message
            # or if it's a permanent failure. For now, we'll just log it.
            # ch.basic_nack(delivery_tag=method.delivery_tag) # To re-queue
            pass

    channel.basic_consume(queue=QUEUE_NAME, on_message_callback=callback)
    channel.start_consuming()

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print('Interrupted')

