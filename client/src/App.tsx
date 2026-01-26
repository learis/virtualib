import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Layout } from './components/Layout';
import { useAuthStore } from './store/authStore';

import { Books } from './pages/Books';
import { Users } from './pages/Users';
import { Requests } from './pages/Requests';
import { Categories } from './pages/Categories';
import { Settings } from './pages/Settings';
import { Libraries } from './pages/Libraries';
import { Loans } from './pages/Loans';

const PrivateRoute = ({ children }: { children: React.ReactElement }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? children : <Navigate to="/login" />;
};

const AdminRoute = ({ children }: { children: React.ReactElement }) => {
  const user = useAuthStore((state) => state.user);
  return user?.role === 'admin' ? children : <Navigate to="/books" replace />;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route path="dashboard" element={<AdminRoute><Dashboard /></AdminRoute>} />
          <Route path="books" element={<Books />} />
          <Route path="libraries" element={<AdminRoute><Libraries /></AdminRoute>} />
          <Route path="categories" element={<Categories />} />
          <Route path="users" element={<AdminRoute><Users /></AdminRoute>} />
          <Route path="loans" element={<Loans />} />
          <Route path="requests" element={<Requests />} />
          <Route path="settings" element={<AdminRoute><Settings /></AdminRoute>} />
          <Route path="" element={<Navigate to={useAuthStore.getState().user?.role === 'admin' ? "/dashboard" : "/books"} replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
