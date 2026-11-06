"use client";

import { Component, type ReactNode } from "react";

/**
 * One panel's crash stays in that panel. A render error inside it shows here, with a reset;
 * the rest of the cockpit keeps drawing. Panels are what you keep adding, and a new one
 * must not be able to take the page down.
 */
export class PanelBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-start gap-2">
          <p className="text-zinc-700 dark:text-zinc-300">
            This panel crashed: {this.state.error.message}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="rounded border border-zinc-300 px-2.5 py-1 text-sm dark:border-zinc-700"
          >
            Reset this panel
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
