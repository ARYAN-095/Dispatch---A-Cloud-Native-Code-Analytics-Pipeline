# worker.py - The FIRST worker in our pipeline.
# It consumes from 'analysis_jobs', clones the repo, and publishes to the next queue.

import pika
import time
import json
import os
import firebase_admin
from firebase_admin import credentials, firestore
import git # The GitPython library
import shutil # For safely deleting directories

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
CONSUME_QUEUE_NAME = 'analysis_jobs'
PUBLISH_QUEUE_NAME = 'cloning_complete_jobs' 


def main():
    """Main function to connect to RabbitMQ and start consuming messages."""
    connection = pika.BlockingConnection(pika.URLParameters(RABBITMQ_URL))
    channel = connection.channel()

    channel.queue_declare(queue=CONSUME_QUEUE_NAME, durable=True)
    channel.queue_declare(queue=PUBLISH_QUEUE_NAME, durable=True)
    
    print(' [*] Cloning worker waiting for messages. To exit press CTRL+C')

    def callback(ch, method, properties, body):
        """Processes a message: clones repo, updates Firestore, and passes to next queue."""
        
        job_id = None
        try:
            job_payload = json.loads(body.decode())
            repo_url = job_payload['repoUrl']
            user_id = job_payload['userId']
            
            print(f" [x] Received job: Clone {repo_url}")

            job_data = {
                'userId': user_id,
                'repoUrl': repo_url,
                'status': 'Queued',
                'createdAt': firestore.SERVER_TIMESTAMP,
                'updatedAt': firestore.SERVER_TIMESTAMP,
                'report': None
            }
            doc_ref = db.collection('jobs').add(job_data)
            job_id = doc_ref[1].id
            print(f" [->] Created Firestore document with ID: {job_id}")

            job_doc = db.collection('jobs').document(job_id)
            job_doc.update({'status': 'Cloning', 'updatedAt': firestore.SERVER_TIMESTAMP})
            
            clone_dir = f"./temp_repos/{job_id}"
            if os.path.exists(clone_dir):
                shutil.rmtree(clone_dir)
            
            print(f" [->] Cloning repository into {clone_dir}...")
            git.Repo.clone_from(repo_url, clone_dir)
            print(f" [✓] Cloning successful.")

            job_doc.update({'status': 'Cloning Complete', 'updatedAt': firestore.SERVER_TIMESTAMP})

            next_job_payload = {
                'jobId': job_id,
                'cloneDir': clone_dir
            }
            
            # --- FIX: Use basic_publish, not send_to_queue ---
            channel.basic_publish(
                exchange='',                      # Default exchange
                routing_key=PUBLISH_QUEUE_NAME,   # The queue name
                body=json.dumps(next_job_payload),
                properties=pika.BasicProperties(
                    delivery_mode=2, # Make message persistent
                )
            )
            print(f" [->] Sent job ID {job_id} to queue '{PUBLISH_QUEUE_NAME}'")

            ch.basic_ack(delivery_tag=method.delivery_tag)
            print(f" [✓] Acknowledged job from '{CONSUME_QUEUE_NAME}'.")

        except Exception as e:
            print(f" [!] Error processing job: {e}")
            if job_id:
                db.collection('jobs').document(job_id).update({
                    'status': 'Error', 
                    'errorDetails': str(e),
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
