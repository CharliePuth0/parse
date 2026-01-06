import React, { useState } from 'react';
import { useTasks } from '../hooks/useApi';
import { api } from '../api/client';
import { formatDate } from '../utils/helpers';
import { Plus, FolderGit2, Loader2, Play, GitBranch, GitCommit, ArrowRight, Zap } from 'lucide-react';

const AnalysisPage = () => {
    const { tasks, loading, refetch } = useTasks();
    const [showForm, setShowForm] = useState(false);

    // Quick vArmor Config
    const VARMOR_CONFIG = {
        repo_path: '/Users/sugerdaddy/ai/tool/vArmor',
        base_commit: 'HEAD~10',
        target_commit: 'HEAD'
    };

    const [formData, setFormData] = useState({
        repo_path: '',
        base_commit: 'main',
        target_commit: 'HEAD',
    });
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e, customData = null) => {
        if (e) e.preventDefault();
        setSubmitting(true);

        // Use custom data (for vArmor quick start) or form data
        const dataToSubmit = customData || formData;

        try {
            await api.createAnalysis(dataToSubmit);
            setShowForm(false);
            // Reset only if not custom action
            if (!customData) {
                setFormData({ repo_path: '', base_commit: 'main', target_commit: 'HEAD' });
            }
            refetch();
        } catch (error) {
            alert('Failed to create analysis: ' + error.message);
        } finally {
            setSubmitting(false);
        }
    };

    // Dedicated handler for vArmor Quick Analysis
    const handleVArmorAnalysis = () => {
        handleSubmit(null, VARMOR_CONFIG);
    };

    return (
        <div className="space-y-8">
            {/* Header Section */}
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Analysis Tasks</h1>
                    <p className="text-slate-500 mt-2">Manage and monitor your code risk analysis jobs</p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="btn-primary flex items-center space-x-2"
                >
                    <Plus className="w-5 h-5" />
                    <span>New Analysis</span>
                </button>
            </div>

            {/* Recommended Action Card - vArmor */}
            <div className="card p-6 border-l-4 border-l-brand-600 bg-gradient-to-r from-white to-brand-50/50">
                <div className="flex justify-between items-center">
                    <div className="space-y-2">
                        <div className="flex items-center space-x-2 text-brand-700 font-semibold text-lg">
                            <Zap className="w-5 h-5" />
                            <span>Recommended Analysis: vArmor Project</span>
                        </div>
                        <p className="text-slate-600 max-w-2xl">
                            One-click analysis for the <strong>vArmor</strong> repository.
                            Compares the latest commit (HEAD) against the version from 10 commits ago (HEAD~10).
                        </p>
                        <div className="flex items-center space-x-4 text-sm font-mono text-slate-500 bg-white/50 p-2 rounded-lg border border-slate-200 inline-flex">
                            <span className="flex items-center"><FolderGit2 className="w-4 h-4 mr-2" /> .../ai/tool/vArmor</span>
                            <span className="flex items-center text-slate-300">|</span>
                            <span className="flex items-center"><GitBranch className="w-4 h-4 mr-2" /> HEAD~10 <ArrowRight className="w-3 h-3 mx-2" /> HEAD</span>
                        </div>
                    </div>
                    <button
                        onClick={handleVArmorAnalysis}
                        disabled={submitting}
                        className="flex items-center space-x-2 px-6 py-3 bg-brand-600 text-white rounded-lg hover:bg-brand-700 shadow-lg shadow-brand-500/30 transition-all font-medium disabled:opacity-70 disabled:cursor-not-allowed transform hover:-translate-y-0.5"
                    >
                        {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-current" />}
                        <span>Run vArmor Analysis</span>
                    </button>
                </div>
            </div>

            {/* Manual Creation Form */}
            {showForm && (
                <div className="card p-6 animate-fade-in border-brand-100 ring-4 ring-brand-50">
                    <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center">
                        <GitCommit className="w-5 h-5 mr-2 text-brand-500" />
                        Custom Analysis Configuration
                    </h2>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Repository Path (Local Absolute Path)
                            </label>
                            <div className="relative">
                                <FolderGit2 className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                                <input
                                    type="text"
                                    required
                                    value={formData.repo_path}
                                    onChange={(e) => setFormData({ ...formData, repo_path: e.target.value })}
                                    placeholder="/Users/username/projects/my-go-repo"
                                    className="input-field pl-10 font-mono text-sm"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Base Commit (Start)
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.base_commit}
                                    onChange={(e) => setFormData({ ...formData, base_commit: e.target.value })}
                                    placeholder="e.g. main, HEAD~10, v1.0.0"
                                    className="input-field font-mono"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Target Commit (End)
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.target_commit}
                                    onChange={(e) => setFormData({ ...formData, target_commit: e.target.value })}
                                    placeholder="e.g. HEAD, feat/branch"
                                    className="input-field font-mono"
                                />
                            </div>
                        </div>
                        <div className="flex space-x-3 pt-2">
                            <button
                                type="submit"
                                disabled={submitting}
                                className="btn-primary min-w-[120px] flex justify-center items-center"
                            >
                                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                {submitting ? 'Running...' : 'Start Analysis'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowForm(false)}
                                className="btn-secondary"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Task List */}
            <div className="space-y-4">
                <h2 className="text-lg font-bold text-slate-800 flex items-center">
                    Recent History
                    <span className="ml-3 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium border border-slate-200">
                        {tasks.length} tasks
                    </span>
                </h2>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-dashed border-slate-200">
                        <Loader2 className="w-10 h-10 animate-spin text-brand-500 mb-4" />
                        <p className="text-slate-500 font-medium">Loading tasks...</p>
                    </div>
                ) : tasks.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-200">
                        <FolderGit2 className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                        <p className="text-slate-900 font-medium text-lg">No analysis tasks yet</p>
                        <p className="text-slate-500">Create your first analysis to see results here</p>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {tasks.map(task => (
                            <div key={task.id} className="card p-5 hover:border-brand-200 group">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center space-x-3 mb-2">
                                            <h3 className="font-mono font-semibold text-brand-600 truncate" title={task.id}>
                                                {task.id}
                                            </h3>
                                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${task.status === 'completed' ? 'bg-green-100 text-green-700 border border-green-200' :
                                                    task.status === 'running' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200 animate-pulse' :
                                                        task.status === 'failed' ? 'bg-red-100 text-red-700 border border-red-200' :
                                                            'bg-slate-100 text-slate-700 border border-slate-200'
                                                }`}>
                                                {task.status}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-sm text-slate-600">
                                            <div className="flex items-center">
                                                <FolderGit2 className="w-4 h-4 mr-2 text-slate-400" />
                                                <span className="truncate" title={task.repo_path}>{task.repo_path}</span>
                                            </div>
                                            <div className="flex items-center font-mono text-xs">
                                                <GitCommit className="w-4 h-4 mr-2 text-slate-400" />
                                                <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">{task.base_commit}</span>
                                                <ArrowRight className="w-3 h-3 mx-2 text-slate-300" />
                                                <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">{task.target_commit}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="ml-6 flex flex-col items-end space-y-3">
                                        <div className="text-right">
                                            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Created</p>
                                            <p className="text-sm font-medium text-slate-700">{formatDate(task.created_at)}</p>
                                        </div>

                                        <div className="w-48">
                                            <div className="flex justify-between text-xs mb-1.5">
                                                <span className="text-slate-500 font-medium">Progress</span>
                                                <span className="text-brand-600 font-bold">{task.progress || 0}%</span>
                                            </div>
                                            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                                <div
                                                    className="bg-brand-500 h-2 rounded-full transition-all duration-500 ease-out relative"
                                                    style={{ width: `${task.progress || 0}%` }}
                                                >
                                                    {task.status === 'running' && (
                                                        <div className="absolute inset-0 bg-white/30 animate-[shimmer_2s_infinite]"></div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {task.error && (
                                    <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg flex items-start text-sm text-red-700">
                                        <div className="w-1 h-4 bg-red-400 rounded-full mr-3 mt-0.5"></div>
                                        {task.error}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AnalysisPage;
