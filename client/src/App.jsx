import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";
import { useAuth } from "./context/contexts";

function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route
        path="/"
        element={user ? <Home key={user.id} /> : <Navigate to="/login" replace />}
      />
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route
        path="/register"
        element={user ? <Navigate to="/" replace /> : <Register />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
