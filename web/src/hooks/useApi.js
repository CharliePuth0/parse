import { useState, useEffect } from 'react';
import { api } from '../api/client';

export const useTasks = () => {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchTasks = async () => {
        try {
            setLoading(true);
            const response = await api.listTasks();
            setTasks(response.data.data || []);
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTasks();
        const interval = setInterval(fetchTasks, 5000);
        return () => clearInterval(interval);
    }, []);

    return { tasks, loading, error, refetch: fetchTasks };
};

export const useTask = (taskId) => {
    const [task, setTask] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!taskId) return;

        const fetchTask = async () => {
            try {
                setLoading(true);
                const response = await api.getTask(taskId);
                setTask(response.data.data);
                setError(null);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchTask();
        const interval = setInterval(fetchTask, 2000);
        return () => clearInterval(interval);
    }, [taskId]);

    return { task, loading, error };
};
