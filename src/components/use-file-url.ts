"use client";

import { useEffect, useState } from "react";
import { getFileUrl } from "@/lib/files";

/** URL temporal de un archivo guardado en el navegador. */
export function useFileUrl(id?: string) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!id);
  useEffect(() => {
    let cancel = false, u: string | null = null;
    if (!id) { setUrl(null); setLoading(false); return; }
    setLoading(true);
    getFileUrl(id).then((x) => { u = x; if (!cancel) { setUrl(x); setLoading(false); } });
    return () => { cancel = true; if (u) URL.revokeObjectURL(u); };
  }, [id]);
  return { url, loading };
}
