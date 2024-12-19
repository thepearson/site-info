const Queue = require('bee-queue');
const redis = require('ioredis');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const puppeteer = require('puppeteer');
const webappalyzer = require('webappalyzer-js');
const { log } = require('./utilities/logger');

// Load configuration (unchanged)
const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));

// Redis clients
const redisClient = new redis.Cluster([config.redis]);

const taskQueue = new Queue('task-queue', { redis: config.redis });
const statusQueue = new Queue('status-queue', { redis: config.redis });

async function processTask(job) {
    const { url, taskId } = job.data;
    const lockKey = `task-lock:${taskId}`;

    try {
        // Acquire lock (unchanged)
        const lockResult = await redisClient.multi()
            .setNX(lockKey, 'locked')
            .expire(lockKey, 60) // Lock expires after 1 minute
            .exec();
        if (!lockResult[0][1]) {
            log(`Task ${taskId} is already being processed by another worker.`);
            return; // Exit if lock not acquired
        }
        await taskQueue.getJob(job.id).remove();

        log(`Starting scan for URL: ${url} (Task ID: ${taskId})`);

        await redisClient.hSet(`task:${taskId}`, 'status', 'processing');
        await redisClient.hSet(`task:${taskId}`, 'url', url);

        let results = {
            urls: [],
            technologies: [],
            errors: []
        };

        try {
            const browser = await puppeteer.launch({ headless: "new" });
            const page = await browser.newPage();
            await page.goto(url);

            // Get all the links from the page
            const hrefs = await page.$$eval('a', as => as.map(a => a.href));
            results.urls = hrefs;

            const analyzer = new webappalyzer.WebAppalyzer();
            const analyzeResults = await analyzer.analyze(url);
            results.technologies = analyzeResults.technologies;

            await browser.close();

        } catch (error) {
            log(`Puppeteer/WebAppAnalyzer Error for URL: ${url} (Task ID: ${taskId}): ${error.message}`);
            results.errors.push(error.message);
            await redisClient.hSet(`task:${taskId}`, 'status', 'failed');
        }

        await redisClient.hSet(`task:${taskId}`, 'results', JSON.stringify(results));
        await redisClient.hSet(`task:${taskId}`, 'status', 'completed');

        log(`Scan completed for URL: ${url} (Task ID: ${taskId})`);
        await redisClient.del(lockKey);

    } catch (error) {
        console.error("Error processing task:", error);
        log(`Error processing task (taskId: ${taskId}): ${error.message}`);
        await redisClient.hSet(`task:${taskId}`, 'status', 'failed');
        try {
            await redisClient.del(lockKey);
        } catch (lockError) {
            console.error("Error releasing lock:", lockError); // Log any lock release errors
        }
    } finally {
        await redisClient.quit();
    }
}

taskQueue.process(processTask);