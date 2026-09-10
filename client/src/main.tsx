import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

// StrictMode double-mount breaks getUserMedia / WebRTC during dev.
createRoot(document.getElementById('root')!).render(<App />);
