const express = require('express');
const Queue = require('bee-queue');
const { v4: uuidv4 } = require('uuid');
const redis = require('ioredis'); // Use ioredis for better Redis features
const fs = require('fs');
const { log } = require('./utilities/logger');

// Load configuration
const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));

// Redis client
const redisClient = new redis.Cluster([config.redis]);

const taskQueue = new Queue('task-queue', { redis: config.redis });
// Status queue is only used by workers, not directly by the API

const app = express();
app.use(express.json());


app.post('/scan', async (req, res) => {
    try {
        const { url } = req.body;

        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        const taskId = uuidv4();

        // Store initial task status in Redis
        await redisClient.hSet(`task:${taskId}`, 'status', 'queued');
        await redisClient.expire(`task:${taskId}`, config.task.ttl);

        // Create a job in the task queue
        const job = await taskQueue.createJob({ url, taskId }).save();
        log(`Job created: ${job.id} for URL: ${url} with task ID: ${taskId}`);

        res.status(202).json({ taskId });
    } catch (error) {
        console.error("Error creating scan job:", error);
        log(`Error creating scan job: ${error.message}`);
        res.status(500).json({ error: 'Failed to create scan job' });
    }
});

app.get('/scan/:taskId', async (req, res) => {
    try {
        const taskId = req.params.taskId;

        const taskData = await redisClient.hGetAll(`task:${taskId}`);
        if (Object.keys(taskData).length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }

        res.json(taskData);
    } catch (error) {
        console.error("Error getting task status:", error);
        log(`Error getting task status: ${error.message}`);
        res.status(500).json({ error: 'Failed to get task status' });
    }
});

app.listen(config.api.port, () => {
    console.log(`API listening on port ${config.api.port}`);
    log(`API started listening on port ${config.api.port}`);
});

module.exports = app;