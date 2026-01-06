import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Activity, Home, Network, FileText, BarChart3, Settings, Github, ChevronRight, Target } from 'lucide-react';

const Layout = ({ children }) => {
    const location = useLocation();

    const isActive = (path) => location.pathname === path;

    const navItems = [
        { path: '/', icon: Home, label: 'Dashboard' },
        { path: '/analysis', icon: Network, label: 'Analysis' },
        { path: '/graph', icon: BarChart3, label: 'Call Graph' },
        { path: '/impact', icon: Target, label: 'Impact Analysis' },
        { path: '/reports', icon: FileText, label: 'Reports' },
    ];

    return (
        <div className="flex h-screen bg-slate-50">
            {/* Sidebar - Enhanced visuals */}
            <aside className="w-72 bg-slate-900 text-white flex flex-col shadow-2xl z-20 transition-all duration-300 ease-in-out">
                {/* Brand Area */}
                <div className="h-20 flex items-center px-8 border-b border-slate-800 bg-slate-950/50 backdrop-blur-sm">
                    <div className="flex items-center space-x-3">
                        <div className="p-2 bg-brand-500/10 rounded-lg border border-brand-500/20">
                            <Activity className="w-6 h-6 text-brand-400" />
                        </div>
                        <div>
                            <h1 className="font-bold text-lg tracking-tight text-white">CodeRisk</h1>
                            <p className="text-xs text-slate-400 font-medium tracking-wide">VISUALIZER PRO</p>
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-4 py-8 space-y-1.5 overflow-y-auto">
                    <div className="px-4 mb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Main Menu
                    </div>
                    {navItems.map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`group flex items-center justify-between px-4 py-3.5 rounded-xl transition-all duration-300 relative overflow-hidden ${isActive(item.path)
                                    ? 'bg-brand-600 text-white shadow-glow'
                                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                }`}
                        >
                            <div className="flex items-center space-x-3 relative z-10">
                                <item.icon className={`w-5 h-5 transition-transform duration-300 ${isActive(item.path) ? 'scale-110' : 'group-hover:scale-110'}`} />
                                <span className="font-medium text-sm">{item.label}</span>
                            </div>
                            {isActive(item.path) && (
                                <ChevronRight className="w-4 h-4 text-brand-200 animate-slide-up" />
                            )}
                        </Link>
                    ))}
                </nav>

                {/* Footer Info */}
                <div className="p-6 border-t border-slate-800 bg-slate-950/30">
                    <div className="flex items-center space-x-3 text-slate-400 hover:text-white transition-colors cursor-pointer">
                        <div className="p-2 bg-slate-800 rounded-full">
                            <Github className="w-4 h-4" />
                        </div>
                        <div className="text-xs">
                            <p className="font-medium">vArmor Project</p>
                            <p className="text-slate-500">v2.0.0 Stable</p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50">
                {/* Top Header */}
                <header className="h-20 bg-white border-b border-slate-200 shadow-sm px-8 flex justify-between items-center z-10">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 tracking-tight">
                            {navItems.find(i => isActive(i.path))?.label || 'Overview'}
                        </h2>
                        <p className="text-sm text-slate-500">Comprehensive code change risk analysis</p>
                    </div>

                    <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-full border border-green-200">
                            <span className="relative flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                            </span>
                            <span className="text-sm font-medium">System Online</span>
                        </div>
                        <button className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors">
                            <Settings className="w-5 h-5" />
                        </button>
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-brand-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg shadow-brand-500/20">
                            U
                        </div>
                    </div>
                </header>

                {/* Viewport for Pages */}
                <main className="flex-1 overflow-auto p-8 scroll-smooth">
                    <div className="max-w-7xl mx-auto animate-fade-in">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default Layout;
