# worker.py - The SECOND worker in our pipeline.
# Consumes from 'cloning_complete_jobs', simulates a scan, and publishes to the next queue.

import pika
import time
import json
import os
import firebase_admin
from firebase_admin import credentials, firestore
import shutil # To clean up the cloned repo directory

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
RABBITMQ_URL = 'amqp://guest:guest@localhost:5672/'
CONSUME_QUEUE_NAME = 'cloning_complete_jobs'
PUBLISH_QUEUE_NAME = 'security_scan_complete_jobs' 


def main():
    """Main function to connect to RabbitMQ and start consuming messages."""
    connection = pika.BlockingConnection(pika.URLParameters(RABBITMQ_URL))
    channel = connection.channel()

    channel.queue_declare(queue=CONSUME_QUEUE_NAME, durable=True)
    channel.queue_declare(queue=PUBLISH_QUEUE_NAME, durable=True)
    
    print(' [*] Security worker waiting for messages. To exit press CTRL+C')

    def callback(ch, method, properties, body):
        """Processes a message: simulates scan, updates Firestore, passes to next queue."""
        
        job_id = None
        clone_dir = None
        try:
            message = json.loads(body.decode())
            job_id = message['jobId']
            clone_dir = message['cloneDir']

            job_doc = db.collection('jobs').document(job_id)
            
            print(f" [x] Received job ID {job_id}. Starting security scan.")

            job_doc.update({'status': 'Analyzing Security', 'updatedAt': firestore.SERVER_TIMESTAMP})
            
            print(f" [->] Simulating security scan on {clone_dir}...")
            time.sleep(5)
            print(f" [✓] Security scan simulation complete.")
            
            mock_vulnerabilities = [
                {'id': 'CVE-2023-1234', 'severity': 'High', 'package': 'left-pad'},
                {'id': 'CVE-2023-5678', 'severity': 'Medium', 'package': 'express'},
            ]
            
            job_doc.update({
                'status': 'Security Scan Complete', 
                'updatedAt': firestore.SERVER_TIMESTAMP,
                'report.security': {
                    'vulnerabilitiesFound': len(mock_vulnerabilities),
                    'details': mock_vulnerabilities
                }
            })

            if os.path.exists(clone_dir):
                shutil.rmtree(clone_dir)
                print(f" [✓] Cleaned up directory {clone_dir}")

            # --- FIX: Use basic_publish, not send_to_queue ---
            next_job_payload = {'jobId': job_id}
            channel.basic_publish(
                exchange='',
                routing_key=PUBLISH_QUEUE_NAME,
                body=json.dumps(next_job_payload),
                properties=pika.BasicProperties(delivery_mode=2)
            )
            print(f" [->] Sent job ID {job_id} to queue '{PUBLISH_QUEUE_NAME}'")

            ch.basic_ack(delivery_tag=method.delivery_tag)
            print(f" [✓] Acknowledged job from '{CONSUME_QUEUE_NAME}'.")

        except Exception as e:
            print(f" [!] Error in security worker: {e}")
            if job_id:
                db.collection('jobs').document(job_id).update({
                    'status': 'Error', 
                    'errorDetails': f"Error during security scan: {str(e)}",
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
