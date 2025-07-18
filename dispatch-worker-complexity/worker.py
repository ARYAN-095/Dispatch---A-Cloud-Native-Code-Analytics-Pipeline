# worker.py - The FINAL worker in our pipeline.
# Consumes from 'security_scan_complete_jobs' and marks the job as complete.

import pika
import time
import json
import os
import firebase_admin
from firebase_admin import credentials, firestore

# --- Firebase Admin SDK Initialization ---
SERVICE_ACCOUNT_KEY_PATH = os.environ.get('SERVICE_ACCOUNT_KEY_PATH', 'serviceAccountKey.json')
try:
    cred = credentials.Certificate(SERVICE_ACCOUNT_KEY_PATH)
    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred)
    print("Successfully initialized Firebase Admin SDK")
except Exception as e:
    print(f"Error initializing Firebase Admin SDK: {e}")
    exit(1)
db = firestore.client()
print("Firestore client created")


# --- RabbitMQ Connection Details ---
RABBITMQ_URL = 'amqp://guest:guest@rabbitmq:5672';
# This worker CONSUMES from 'security_scan_complete_jobs'
CONSUME_QUEUE_NAME = 'security_scan_complete_jobs'


def main():
    """Main function to connect to RabbitMQ and start consuming messages."""
    connection = pika.BlockingConnection(pika.URLParameters(RABBITMQ_URL))
    channel = connection.channel()

    # This worker only needs to declare the queue it's listening to.
    channel.queue_declare(queue=CONSUME_QUEUE_NAME, durable=True)
    
    print(' [*] Complexity worker waiting for messages. To exit press CTRL+C')

    def callback(ch, method, properties, body):
        """Processes a message: simulates complexity scan, marks job as complete."""
        
        job_id = None
        try:
            message = json.loads(body.decode())
            job_id = message['jobId']

            job_doc = db.collection('jobs').document(job_id)
            
            print(f" [x] Received job ID {job_id}. Starting complexity analysis.")

            # 1. Update status to 'Analyzing Complexity'
            job_doc.update({'status': 'Analyzing Complexity', 'updatedAt': firestore.SERVER_TIMESTAMP})
            
            # 2. --- SIMULATE THE ANALYSIS ---
            # In a real app, you would run a tool like 'radon' or 'lizard'.
            print(f" [->] Simulating complexity analysis...")
            time.sleep(3) # Simulate a 3-second analysis
            print(f" [✓] Complexity analysis simulation complete.")
            
            # 3. Update status to 'Complete' and add final report data
            job_doc.update({
                'status': 'Complete', 
                'updatedAt': firestore.SERVER_TIMESTAMP,
                'report.complexity': {
                    'cyclomatic': 12,
                    'maintainability': 85,
                }
            })
            
            print(f" [✓] Job {job_id} marked as Complete in Firestore.")

            # 4. Acknowledge the message. This is the final step.
            ch.basic_ack(delivery_tag=method.delivery_tag)
            print(f" [✓] Final job acknowledgement for '{CONSUME_QUEUE_NAME}'.")

        except Exception as e:
            print(f" [!] Error in complexity worker: {e}")
            if job_id:
                db.collection('jobs').document(job_id).update({
                    'status': 'Error', 
                    'errorDetails': f"Error during complexity analysis: {str(e)}",
                    'updatedAt': firestore.SERVER_TIMESTAMP
                })
            ch.basic_ack(delivery_tag=method.delivery_tag)

    channel.basic_consume(queue=CONSUME_QUEUE_NAME, on_message_callback=callback)
    channel.start_consuming()

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print('Interrupted')
