// Test helper (npm test): wrapper: the app's providers around a page at a given URL.
import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { UiLangProvider } from './context/UiLangContext';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';

export function renderAt(path, routes) {
  return render(
    <ThemeProvider><UiLangProvider><AuthProvider>
      <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          {routes}
          <Route path="*" element={<div data-testid="landed" />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider></UiLangProvider></ThemeProvider>
  );
}
export { Route };
