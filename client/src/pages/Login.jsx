import { useState } from "react";
import { Link } from "react-router-dom";
import { AuthLayout, Field, FormError } from "../components/AuthLayout";
import { Button } from "../components/ui/Modal";
import Spinner from "../components/ui/Spinner";
import { loginUser } from "../services/authService";
import { useAuth } from "../context/contexts";
import { errorMessage } from "../lib/api";

function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await loginUser({ email, password });
      login(response.data.user, response.data.token);
    } catch (err) {
      setError(errorMessage(err, "Could not sign you in."));
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to continue your conversations"
      footer={
        <>
          New here?{" "}
          <Link to="/register" className="font-semibold text-brand hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        <FormError>{error}</FormError>
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          autoFocus
        />
        <Field
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="Your password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        <Button type="submit" disabled={loading} className="mt-2 w-full py-2.5">
          {loading && <Spinner className="h-4 w-4" />}
          Sign in
        </Button>
      </form>
    </AuthLayout>
  );
}

export default Login;
