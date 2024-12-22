const express = require('express');
const amqp = require('amqplib'); // Import the RabbitMQ client library
const crypto = require('crypto'); // Import the crypto module for hash generation
const fs = require('fs'); // Import the fs module for file system operations
const { log } = require('./utilities/logger');

const app = express();
const port = 3000;

// RabbitMQ connection details
const rabbitmqHost = 'rabbitmq'; // service name from docker-compose
const queueName = 'tasks';

// Function to establish a connection to RabbitMQ
async function connectToRabbitMQ() {
  const connection = await amqp.connect(`amqp://${rabbitmqHost}`); // Connect to RabbitMQ
  const channel = await connection.createChannel(); // Create a channel
  await channel.assertQueue(queueName, { durable: true }); // Assert the queue exists and is durable
  return channel;
}

app.use(express.json()); // Middleware to parse JSON request bodies

app.post('/queue', async (req, res) => {
  const { url, checks } = req.body; // Extract url and checks from the request body

  // Validate the request data
  if (!url || !checks || !Array.isArray(checks)) {
    return res.status(400).json({ error: 'Invalid request data' });
  }

  // Generate a short hash from the URL as the task ID
  const id = crypto.createHash('md5').update(url).digest('hex').substring(0, 8);

  // Create the task object
  const task = {
    id,
    url,
    checks,
    status: 'queued'
  };

  try {
    const channel = await connectToRabbitMQ(); // Get a RabbitMQ channel
    // Send the task message to the queue
    await channel.sendToQueue(queueName, Buffer.from(JSON.stringify(task)), { persistent: true });
    log(`Task ${id} queued`);

    // Create the output file
    const filePath = `outputs/${id}.json`;
    const initialData = { id, url, status: 'queued' }; // Added url to initialData
    fs.writeFileSync(filePath, JSON.stringify(initialData));
    
    res.json(task); // Return the task details in the response
  } catch (error) {
    log(`Error queuing task: ${error}`);
    res.status(500).json({ error: 'Failed to queue task' });
  }
});

app.get('/status/:id', (req, res) => {
  const taskId = req.params.id; // Extract the task ID from the request parameters
  const filePath = `outputs/${taskId}.json`; // Construct the file path

  // Read the task status from the file
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        return res.status(404).json({ error: 'Task not found' }); // File not found
      }
      log(`Error reading task status: ${err}`);
      return res.status(500).json({ error: 'Failed to read task status' }); // Other file system error
    }
    res.json(JSON.parse(data)); // Parse the JSON data and send it in the response
  });
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});