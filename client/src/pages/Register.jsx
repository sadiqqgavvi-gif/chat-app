import { useState } from "react";
import { Link } from "react-router-dom";
import { AuthLayout, Field, FormError } from "../components/AuthLayout";
import { Button } from "../components/ui/Modal";
import Spinner from "../components/ui/Spinner";
import { registerUser } from "../services/authService";
import { useAuth } from "../context/contexts";
import { errorMessage } from "../lib/api";

function Register() {
  const { login } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (field) => (event) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  const tooShort = form.password.length > 0 && form.password.length < 6;
  const mismatch = form.confirm.length > 0 && form.confirm !== form.password;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (form.password.length < 6 || form.confirm !== form.password) return;

    setLoading(true);
    setError("");

    try {
      // Registering signs you in straight away.
      const response = await registerUser({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      login(response.data.user, response.data.token);
    } catch (err) {
      setError(errorMessage(err, "Could not create your account."));
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start chatting in less than a minute"
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-brand hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        <FormError>{error}</FormError>
        <Field
          label="Name"
          autoComplete="name"
          placeholder="Your name"
          maxLength={50}
          value={form.name}
          onChange={set("name")}
          required
          autoFocus
        />
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={form.email}
          onChange={set("email")}
          required
        />
        <Field
          label="Password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 6 characters"
          value={form.password}
          onChange={set("password")}
          error={tooShort ? "Use at least 6 characters." : ""}
          required
        />
        <Field
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          placeholder="Repeat your password"
          value={form.confirm}
          onChange={set("confirm")}
          error={mismatch ? "Passwords don't match." : ""}
          required
        />
        <Button type="submit" disabled={loading} className="mt-2 w-full py-2.5">
          {loading && <Spinner className="h-4 w-4" />}
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}

export default Register;
