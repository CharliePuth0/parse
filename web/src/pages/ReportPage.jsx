import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { formatDate, getRiskColor } from '../utils/helpers';
import { Search, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';

const ReportPage = () => {
    const [taskId, setTaskId] = useState('');
    const [loading, setLoading] = useState(false);
    const [report, setReport] = useState(null);
    const [error, setError] = useState(null);

    const handleLoad = async () => {
        if (!taskId) {
            alert('Please enter a task ID');
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const response = await api.getReport(taskId);
            setReport(response.data.data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8">
            <div className="max-w-6xl mx-auto">
                <h1 className="text-3xl font-bold text-gray-900 mb-6">Risk Reports</h1>

                {/* Search Bar */}
                <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
                    <div className="flex space-x-3">
                        <input
                            type="text"
                            value={taskId}
                            onChange={(e) => setTaskId(e.target.value)}
                            placeholder="Enter Task ID to view report"
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                            onClick={handleLoad}
                            disabled={loading}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors flex items-center space-x-2"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                            <span>Load Report</span>
                        </button>
                    </div>
                    {error && (
                        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                            Error: {error}
                        </div>
                    )}
                </div>

                {/* Report Content */}
                {report && (
                    <div className="space-y-6">
                        {/* Summary */}
                        <div className="bg-white rounded-xl shadow-lg p-6">
                            <h2 className="text-xl font-semibold mb-4">Analysis Summary</h2>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="text-center p-4 bg-blue-50 rounded-lg">
                                    <p className="text-3xl font-bold text-blue-600">{report.summary?.files_changed || 0}</p>
                                    <p className="text-sm text-gray-600">Files Changed</p>
                                </div>
                                <div className="text-center p-4 bg-purple-50 rounded-lg">
                                    <p className="text-3xl font-bold text-purple-600">{report.summary?.funcs_changed || 0}</p>
                                    <p className="text-sm text-gray-600">Functions Modified</p>
                                </div>
                                <div className="text-center p-4 bg-green-50 rounded-lg">
                                    <p className="text-3xl font-bold text-green-600">{report.summary?.score_breakdown?.complexity_score?.toFixed(1) || 0}</p>
                                    <p className="text-sm text-gray-600">Complexity Score</p>
                                </div>
                                <div className="text-center p-4 bg-red-50 rounded-lg">
                                    <p className="text-3xl font-bold text-red-600">{report.summary?.total_score?.toFixed(1) || 0}</p>
                                    <p className="text-sm text-gray-600">Risk Score</p>
                                </div>
                            </div>
                        </div>

                        {/* File Risks */}
                        {report.files && report.files.length > 0 && (
                            <div className="bg-white rounded-xl shadow-lg p-6">
                                <h2 className="text-xl font-semibold mb-4">File Risk Analysis</h2>
                                <div className="space-y-3">
                                    {report.files.map((file, idx) => (
                                        <div key={idx} className="border border-gray-200 rounded-lg p-4">
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <h3 className="font-medium text-gray-900">{file.path || file.file_path}</h3>
                                                    <p className="text-sm text-gray-600 mt-1">
                                                        Risk Score: <span className="font-semibold">{file.score?.toFixed(2) || 0}</span>
                                                        {' | '}
                                                        Complexity: <span className="font-semibold">{file.complexity || 0}</span>
                                                    </p>
                                                </div>
                                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getRiskColor(file.level)}`}>
                                                    {file.level || 'Unknown'}
                                                </span>
                                            </div>
                                            {file.issues && file.issues.length > 0 && (
                                                <div className="mt-3 space-y-1">
                                                    {file.issues.map((issue, ridx) => (
                                                        <div key={ridx} className="flex items-start space-x-2 text-sm text-gray-700">
                                                            <AlertTriangle className="w-4 h-4 mt-0.5 text-yellow-600" />
                                                            <span>{issue}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Features Detected */}
                        {report.features && report.features.length > 0 && (
                            <div className="bg-white rounded-xl shadow-lg p-6">
                                <h2 className="text-xl font-semibold mb-4">Feature Risk Detection</h2>
                                <div className="space-y-2">
                                    {report.features.map((feature, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                            <div className="flex items-center space-x-3">
                                                <div className={`w-2 h-2 rounded-full ${
                                                    feature.severity === 'high' ? 'bg-red-500' :
                                                    feature.severity === 'medium' ? 'bg-yellow-500' :
                                                    'bg-green-500'
                                                }`} />
                                                <span className="font-medium text-gray-900">{feature.type}</span>
                                                <span className="text-sm text-gray-600">{feature.count} occurrences</span>
                                            </div>
                                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getRiskColor(feature.severity)}`}>
                                                {feature.severity}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {!report && !loading && (
                    <div className="bg-white rounded-xl shadow-lg p-12 text-center">
                        <CheckCircle2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">Enter a task ID to view the risk analysis report</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReportPage;
