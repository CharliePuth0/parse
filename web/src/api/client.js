import axios from 'axios';

const API_BASE = import.meta.env.DEV ? '/api' : '/api';

const client = axios.create({
    baseURL: API_BASE,
    headers: {
        'Content-Type': 'application/json',
    },
});

// API functions
export const api = {
    // Health check
    health: () => client.get('/health'),

    // Tasks
    createAnalysis: (data) => client.post('/analyze', data),
    listTasks: () => client.get('/tasks'),
    getTask: (id) => client.get(`/tasks/${id}`),

    // Reports
    getReport: (id) => client.get(`/reports/${id}`),

    // Call graph
    getCallGraph: (taskId) => client.get(`/callgraph/${taskId}`),

    // Impact graph
    getImpactGraph: (funcName, maxDepth = 5) =>
        client.get('/impact-graph', { params: { function: funcName, max_depth: maxDepth } }),

    // Statistics
    getStatistics: () => client.get('/statistics'),
};

export default client;
