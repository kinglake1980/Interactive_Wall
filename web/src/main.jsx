import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import Audience from './pages/Audience.jsx';
import Screen from './pages/Screen.jsx';
import Admin from './pages/Admin.jsx';
import './styles.css';

const router = createBrowserRouter([
  { path: '/', element: <Audience /> },        // 观众页（手机）
  { path: '/screen', element: <Screen /> },    // 大屏页（投影）
  { path: '/admin', element: <Admin /> },      // 主持人后台页
  { path: '*', element: <Navigate to="/" replace /> },
]);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
