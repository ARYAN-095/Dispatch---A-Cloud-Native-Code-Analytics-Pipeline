# Dockerfile for all Python workers

# Use an official Python runtime as a parent image.
# The 'slim' version is smaller than the default.
FROM python:3.9-slim

# Set the working directory in the container to /app
WORKDIR /app

# Copy the file that lists the dependencies first.
# This is a Docker best practice that leverages layer caching.
COPY requirements.txt requirements.txt

# Install any needed packages specified in requirements.txt
# --no-cache-dir makes the image smaller.
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application's source code into the container at /app
COPY . .

# Define the command to run your app.
# This will execute 'python worker.py' when the container starts.
CMD [ "python", "worker.py" ]
