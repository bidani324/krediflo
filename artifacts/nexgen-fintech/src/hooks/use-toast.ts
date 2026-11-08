/**
 * @fileoverview Toast notification state management for Krediflo.
 *
 * Implements a lightweight, framework-agnostic toast store using a module-level
 * singleton state + listener pattern (similar to Zustand but without the
 * dependency).  The store is shared across all component instances so that
 * toasts triggered from non-React contexts (e.g. API error handlers) propagate
 * to the mounted `<Toaster>` component.
 *
 * Usage:
 *   import { toast } from "@/hooks/use-toast";
 *   toast({ title: "Saved!", description: "Your changes are live." });
 *
 * Within a component:
 *   const { toasts, dismiss } = useToast();
 */

import * as React from "react";
import type { ToastActionElement, ToastProps } from "@/components/ui/toast";
import { TOAST_CONFIG } from "@/config/constants";

/* ─── Types ───────────────────────────────────────────────────────────────── */

/** A fully-hydrated toast object stored in state (ToastProps + metadata). */
type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
};

/** Discriminated union of all actions the reducer can handle. */
const actionTypes = {
  ADD_TOAST:     "ADD_TOAST",
  UPDATE_TOAST:  "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST:  "REMOVE_TOAST",
} as const;

type ActionType = typeof actionTypes;

type Action =
  | { type: ActionType["ADD_TOAST"];     toast: ToasterToast }
  | { type: ActionType["UPDATE_TOAST"];  toast: Partial<ToasterToast> }
  | { type: ActionType["DISMISS_TOAST"]; toastId?: ToasterToast["id"] }
  | { type: ActionType["REMOVE_TOAST"];  toastId?: ToasterToast["id"] };

interface State {
  toasts: ToasterToast[];
}

/** The `id`-less shape accepted by the public `toast()` helper. */
type Toast = Omit<ToasterToast, "id">;

/* ─── ID Generation ───────────────────────────────────────────────────────── */

/** Monotonically-incrementing counter for unique toast IDs within a session. */
let count = 0;

/**
 * @description Generates a unique, stable string ID for each new toast.
 *   Wraps at `Number.MAX_SAFE_INTEGER` to prevent integer overflow in
 *   extremely long-lived sessions.
 *
 * @returns {string} A string representation of the next counter value.
 */
function genId(): string {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

/* ─── Removal Queue ───────────────────────────────────────────────────────── */

/**
 * Map of `toastId → timeoutHandle` tracking which toasts are scheduled
 * for removal.  Prevents duplicate timeouts if `DISMISS_TOAST` is dispatched
 * more than once for the same ID.
 */
const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * @description Schedules the physical removal of a toast from state after the
 *   configured delay.  Toasts are first *dismissed* (animated out, `open: false`)
 *   and then *removed* (fully purged from the array) after `REMOVE_DELAY_MS`.
 *
 * @param {string} toastId - The ID of the toast to schedule for removal.
 */
const addToRemoveQueue = (toastId: string): void => {
  // Guard: don't start a second timer if one is already pending for this ID
  if (toastTimeouts.has(toastId)) return;

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId);
    dispatch({ type: "REMOVE_TOAST", toastId });
  }, TOAST_CONFIG.REMOVE_DELAY_MS);

  toastTimeouts.set(toastId, timeout);
};

/* ─── Reducer ─────────────────────────────────────────────────────────────── */

/**
 * @description Pure state reducer for the toast notification store.
 *
 * Note: `DISMISS_TOAST` triggers a side-effect (scheduling removal via
 * `addToRemoveQueue`).  This is intentional — the reducer is the single
 * authority for the dismiss→remove lifecycle, keeping the public API simple.
 *
 * @param {State} state  - Current toast store state.
 * @param {Action} action - Dispatched action describing the desired mutation.
 * @returns {State} The next state after applying the action.
 */
export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        // Enforce `TOAST_LIMIT` by slicing from the front (newest first)
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_CONFIG.LIMIT),
      };

    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      };

    case "DISMISS_TOAST": {
      const { toastId } = action;
      // Schedule removal — side effect inside reducer, kept here for simplicity
      if (toastId) {
        addToRemoveQueue(toastId);
      } else {
        // Dismiss ALL toasts if no specific ID provided
        state.toasts.forEach((toast) => addToRemoveQueue(toast.id));
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? { ...t, open: false }
            : t
        ),
      };
    }

    case "REMOVE_TOAST":
      if (action.toastId === undefined) {
        return { ...state, toasts: [] };
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      };
  }
};

/* ─── Singleton Store ─────────────────────────────────────────────────────── */

/**
 * Subscribed `setState` callbacks from all mounted `useToast()` instances.
 * When state changes, every listener is notified so all mounted toasters update.
 */
const listeners: Array<(state: State) => void> = [];

/** Module-level state — persists across React renders and component mounts. */
let memoryState: State = { toasts: [] };

/**
 * @description Applies an action to the singleton store and notifies all
 *   subscribed listeners (i.e. every mounted `useToast()` hook instance).
 *
 * @param {Action} action - The action to dispatch.
 */
function dispatch(action: Action): void {
  memoryState = reducer(memoryState, action);
  listeners.forEach((listener) => listener(memoryState));
}

/* ─── Public API ──────────────────────────────────────────────────────────── */

/**
 * @description Imperatively fires a new toast notification.  Can be called
 *   from outside React components (e.g., in API error handlers or utility
 *   modules) because it writes directly to the singleton store.
 *
 * @param {Toast} props - Toast content and variant, excluding `id` (auto-generated).
 * @returns {{ id: string; dismiss: () => void; update: (props: ToasterToast) => void }}
 *   Control handles for the newly created toast.
 *
 * @example
 *   const { dismiss } = toast({ title: "Uploading…", description: "Please wait." });
 *   await uploadFile(file);
 *   dismiss();
 *   toast({ title: "Done!", variant: "default" });
 */
function toast({ ...props }: Toast) {
  const id = genId();

  const update = (props: ToasterToast) =>
    dispatch({ type: "UPDATE_TOAST", toast: { ...props, id } });

  const dismiss = () =>
    dispatch({ type: "DISMISS_TOAST", toastId: id });

  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss();
      },
    },
  });

  return { id, dismiss, update };
}

/**
 * @description React hook that subscribes a component to the global toast store.
 *   Returns the current list of toasts plus imperative `toast` and `dismiss`
 *   helpers.  Re-renders the component whenever the store changes.
 *
 * @returns {{ toasts: ToasterToast[]; toast: typeof toast; dismiss: (id?: string) => void }}
 *   Current toast state and control functions.
 *
 * @example
 *   function MyComponent() {
 *     const { toast } = useToast();
 *     return <button onClick={() => toast({ title: "Hello!" })}>Notify</button>;
 *   }
 */
function useToast() {
  const [state, setState] = React.useState<State>(memoryState);

  React.useEffect(() => {
    // Subscribe to store changes
    listeners.push(setState);
    return () => {
      // Unsubscribe on unmount to prevent calling setState on an unmounted component
      const index = listeners.indexOf(setState);
      if (index > -1) listeners.splice(index, 1);
    };
  }, [state]);

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) =>
      dispatch({ type: "DISMISS_TOAST", toastId }),
  };
}

export { useToast, toast };
