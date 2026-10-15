import { useContext, useEffect, useRef, type ReactNode } from "react";
import { ToastProvider, type ToastOptions } from "../feedback/feedback";
import { useUILocale } from "../foundation/locale";
import { ToastContext } from "./toast-context";

/** Internal fallback; component families share an application's existing queue. */
export function InternalToastBoundary({ children }: { children: ReactNode }) {
  const context = useContext(ToastContext);
  return context ? children : <ToastProvider>{children}</ToastProvider>;
}

/** Own one notification per active episode without resetting its pause-aware clock. */
export function useInternalOwnedToast(active: boolean, options: ToastOptions, episodeKey?: unknown) {
  const context = useContext(ToastContext);
  const locale = useUILocale();
  const latest = useRef({ context, locale, options });
  latest.current = { context, locale, options };
  const mounted = useRef(false);
  const episode = useRef<{ started: boolean; id?: string; key?: unknown }>({ started: false, key: episodeKey });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      // StrictMode immediately sets this flag again; real unmount removes only our message.
      void Promise.resolve().then(() => {
        if (!mounted.current && episode.current.id) latest.current.context?.dismiss(episode.current.id);
      });
    };
  }, []);
  useEffect(() => {
    if (episode.current.key !== episodeKey) {
      if (episode.current.id) context?.dismiss(episode.current.id);
      episode.current = { started: false, key: episodeKey };
    }
    const current = episode.current;
    if (!active) {
      if (current.id) context?.dismiss(current.id);
      episode.current = { started: false, key: episodeKey };
      return;
    }
    if (current.id) {
      context?.update(current.id, options, locale);
      return;
    }
    if (current.started || !context) return;
    current.started = true;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled || !mounted.current || episode.current !== current) return;
      const value = latest.current;
      current.id = value.context?.toast(value.options, value.locale);
    });
    return () => {
      cancelled = true;
      if (!current.id) current.started = false;
    };
  }, [active, context, episodeKey, locale, options.title, options.description, options.tone, options.closable]);
}
