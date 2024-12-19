# Site Info

This Node.js application provides an API for scanning websites and retrieving various information, including DNS records, SSL certificate details, internal and external URLs, and the technologies used to build the site. It uses Bee-Queue for task management, Redis for data storage, Puppeteer for web scraping, and webappalyzer-js for technology detection.

## Features

*   Asynchronous task processing with task ID tracking.
*   Retrieval of DNS information, SSL certificate details, URLs, and website technologies.
*   Configurable data expiration using Redis TTL.
*   Logging to a file for debugging and monitoring.
*   Multiple worker support.

## Prerequisites

*   Node.js (LTS recommended)
*   npm or yarn
*   Docker (for Redis setup)

## Installation

1.  Clone the repository:

    ```bash
    git clone git@github.com:thepearson/site-info.git
    cd site-info
    ```

2.  Install dependencies:

    ```bash
    npm install
    # or
    yarn install
    ```

## Setup

1.  **Redis Setup (using Docker):**

    *   Make sure Docker is installed.
    *   Create a `docker-compose.yml` file in the project root with the following content:

    ```yaml
    version: '3.8'
    services:
      redis:
        image: redis:latest
        restart: unless-stopped
        ports:
          - "6379:6379" # Expose the port - useful for local testing
        volumes:
          - redis-data:/data
    volumes:
      redis-data:
    ```

    *   Run Redis using Docker Compose:

    ```bash
    docker-compose up -d
    ```

2.  **Configuration:**

    *   Create a `config.json` file in the project root. Here's an example:

    ```json
    {
      "redis": {
        "host": "localhost",
        "port": 6379
      },
      "api": {
        "port": 3000
      },
      "task": {
        "ttl": 86400 // 24 hours in seconds
      },
      "log": {
        "file": "scan_log.txt"
      }
    }
    ```

    *   Adjust the settings as needed (e.g., Redis connection details, API port, TTL).

## Running the Application

1.  **Start the API:**

    ```bash
    node api.js
    ```

2.  **Start the worker(s):**

    ```bash
    node worker.js
    # Run multiple workers in separate terminals for concurrent processing
    node worker.js
    node worker.js
    ```

## API Endpoints

*   **`POST /scan`:** Starts a new website scan.

    *   Request body (JSON):

    ```json
    {
      "url": "[https://www.example.com](https://www.example.com)"
    }
    ```

    *   Response (JSON):

    ```json
    {
      "taskId": "generated-uuid"
    }
    ```

*   **`GET /scan/:taskId`:** Retrieves the status and results of a scan.

    *   Response (JSON):

    ```json
    {
      "status": "completed", // Or "queued", "processing", "failed"
      "urls": [ /* ... */ ],
      "technologies": [ /* ... */ ],
      "errors": [ /* ... */ ],
      // ... other scan data
    }
    ```

## Docker Compose (Running the whole stack)

You can also use Docker Compose to run both Redis and the application. Create a `Dockerfile` for your application (example below) then add it to the `docker-compose.yml` file.

```dockerfile
# Use a Node.js base image
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose the API port
EXPOSE 3000

# Start the API
CMD ["node", "api.js"]
```
