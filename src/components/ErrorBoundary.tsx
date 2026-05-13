import { Component, ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("Application render error:", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-background text-foreground p-6">
          <div className="dashboard-card mx-auto max-w-2xl p-5">
            <h1 className="text-lg font-semibold text-destructive">Dashboard failed to render</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {this.state.error.message || "An unexpected display error occurred."}
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
