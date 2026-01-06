import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import AnalysisPage from './pages/AnalysisPage';
import GraphPage from './pages/GraphPage';
import ImpactPage from './pages/ImpactPage';
import ReportPage from './pages/ReportPage';

function App() {
    return (
        <BrowserRouter>
            <Layout>
                <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/analysis" element={<AnalysisPage />} />
                    <Route path="/graph" element={<GraphPage />} />
                    <Route path="/impact" element={<ImpactPage />} />
                    <Route path="/reports" element={<ReportPage />} />
                </Routes>
            </Layout>
        </BrowserRouter>
    );
}

export default App;
