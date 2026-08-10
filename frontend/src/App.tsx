import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './components/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { CustomersPage } from './pages/CustomersPage';
import { CustomerDetailPage } from './pages/CustomerDetailPage';
import { ProductsPage } from './pages/ProductsPage';
import { ChallansPage } from './pages/ChallansPage';
import { NewChallanPage } from './pages/NewChallanPage';
import { ChallanDetailPage } from './pages/ChallanDetailPage';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: 'hsl(222 47% 9%)',
              color: 'hsl(213 31% 91%)',
              border: '1px solid hsl(222 47% 16%)',
              borderRadius: '0.75rem',
              fontSize: '14px',
            },
            success: {
              iconTheme: { primary: 'hsl(142 71% 45%)', secondary: 'hsl(222 47% 9%)' },
            },
            error: {
              iconTheme: { primary: 'hsl(0 84% 60%)', secondary: 'hsl(222 47% 9%)' },
            },
          }}
        />
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <DashboardPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/customers"
            element={
              <ProtectedRoute roles={['ADMIN', 'SALES', 'ACCOUNTS']}>
                <AppLayout>
                  <CustomersPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/customers/:id"
            element={
              <ProtectedRoute roles={['ADMIN', 'SALES', 'ACCOUNTS']}>
                <AppLayout>
                  <CustomerDetailPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/products"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <ProductsPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/challans"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <ChallansPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/challans/new"
            element={
              <ProtectedRoute roles={['ADMIN', 'SALES']}>
                <AppLayout>
                  <NewChallanPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/challans/:id"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <ChallanDetailPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* Warehouse stub */}
          <Route
            path="/warehouse"
            element={
              <ProtectedRoute roles={['ADMIN', 'WAREHOUSE']}>
                <AppLayout>
                  <ProductsPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* Default redirects */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
