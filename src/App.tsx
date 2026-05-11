import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Tournaments from './pages/Tournaments';
import Courts from './pages/Courts';
import Teams from './pages/Teams';
import Players from './pages/Players';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import { Toaster } from './components/ui/sonner';
import { ThemeProvider } from './components/ThemeProvider';

export default function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="volley-connect-theme">
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/tournaments" element={<Tournaments />} />
            <Route path="/courts" element={<Courts />} />
            <Route path="/teams" element={<Teams />} />
            <Route path="/players" element={<Players />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </Layout>
        <Toaster position="top-right" />
      </Router>
    </ThemeProvider>
  );
}
