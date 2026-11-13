import { useEffect, useState } from "react";
import { searchUsers } from "../services/userService";

export function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// Live user search. With `enabled` false nothing is fetched.
export function useUserSearch(query, enabled = true) {
  const term = useDebounced(query.trim(), 250);
  const [state, setState] = useState({ users: [], loading: enabled, term: null });

  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();

    searchUsers(term, controller.signal)
      .then((response) => setState({ users: response.data, loading: false, term }))
      .catch((err) => {
        if (err.code !== "ERR_CANCELED") {
          setState({ users: [], loading: false, term });
        }
      });

    return () => controller.abort();
  }, [term, enabled]);

  return {
    users: enabled ? state.users : [],
    loading: enabled && (state.loading || state.term !== term),
  };
}
