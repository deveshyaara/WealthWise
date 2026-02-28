import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";

const useFetch = (cb) => {
  const [data, setData] = useState(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const isMountedRef = useRef(true);

  // Track unmount to prevent state updates on unmounted components
  const setMountedRef = useCallback((mounted) => {
    isMountedRef.current = mounted;
  }, []);

  const fn = async (...args) => {
    setLoading(true);
    setError(null);

    try {
      const response = await cb(...args);
      if (isMountedRef.current) {
        setData(response);
        setError(null);
      }
    } catch (error) {
      if (isMountedRef.current) {
        setError(error);
        toast.error(error.message);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  return { data, loading, error, fn, setData, setMountedRef };
};

export default useFetch;
