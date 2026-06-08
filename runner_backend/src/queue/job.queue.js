"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jobQueue = void 0;
var bullmq_1 = require("bullmq");
var redis_1 = require("../config/redis");
exports.jobQueue = new bullmq_1.Queue("execution-queue", {
    connection: redis_1.redisConnection,
});
