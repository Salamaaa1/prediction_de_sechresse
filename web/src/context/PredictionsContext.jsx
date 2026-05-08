import { createContext, useContext, useEffect, useState } from 'react';

const Ctx = createContext(null);

export function PredictionsProvider({ children }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/predictions.json')
      .then(r => r.json())
      .then(setData)
      .catch(e => setError(e.message));
  }, []);

  return <Ctx.Provider value={{ data, error }}>{children}</Ctx.Provider>;
}

export function usePredictions() {
  return useContext(Ctx);
}
