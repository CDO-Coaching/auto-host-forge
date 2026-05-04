import { Component, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Optional: where to send the user with the "Retour" button */
  fallbackPath?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Catches render-time JS errors so a single bad field in a session
 * (e.g. malformed JSON, missing exercise data after a week-copy) doesn't
 * leave the user staring at a black screen.
 */
export class PageErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: unknown) {
    // Log so we can see this in the console / Sentry-like tooling
    console.error("[PageErrorBoundary] Render error:", error, info);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleBack = () => {
    if (this.props.fallbackPath) {
      window.location.href = this.props.fallbackPath;
    } else {
      window.history.back();
    }
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full app-card p-6 text-center space-y-4">
          <div className="flex justify-center">
            <div className="h-12 w-12 rounded-full bg-destructive/15 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Oups, un problème d'affichage</h2>
            <p className="text-sm text-muted-foreground">
              Cette séance n'a pas pu s'afficher correctement. Cela peut arriver
              juste après une copie de programmation. Tu peux réessayer ou
              revenir à la liste de tes séances.
            </p>
            {this.state.error?.message && (
              <p className="text-xs text-muted-foreground/70 mt-2 break-words">
                {this.state.error.message}
              </p>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <Button variant="outline" onClick={this.handleBack} className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Retour
            </Button>
            <Button onClick={this.handleRetry} className="gap-2">
              <RefreshCw className="h-4 w-4" /> Réessayer
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
