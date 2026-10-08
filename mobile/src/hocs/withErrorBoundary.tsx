/**
 * withErrorBoundary HOC
 * Wraps a screen component with a MobileErrorBoundary so a render failure
 * in one screen never crashes the whole app.
 *
 * Usage:
 *   export default withErrorBoundary(HomeScreen);
 */

import React, { Component, type ComponentType, type ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme';

interface ErrorFallbackProps {
  error: Error | null;
  onReset: () => void;
}

function DefaultErrorFallback({ error, onReset }: ErrorFallbackProps) {
  return (
    <View style={styles.container} accessible accessibilityLabel="Screen error">
      <Ionicons name="warning-outline" size={48} color={colors.error} />
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.message}>
        This screen couldn't load. The error has been logged. Try again to continue.
      </Text>
      {__DEV__ && error ? (
        <Text style={styles.devError} numberOfLines={3}>
          {error.message}
        </Text>
      ) : null}
      <TouchableOpacity style={styles.button} onPress={onReset} accessible accessibilityRole="button" accessibilityLabel="Try again">
        <Text style={styles.buttonText}>Try again</Text>
      </TouchableOpacity>
    </View>
  );
}

interface State {
  hasError: boolean;
  error: Error | null;
}

function withErrorBoundary<P extends object>(
  WrappedComponent: ComponentType<P>,
  fallback?: ReactNode,
): ComponentType<P> {
  return class extends Component<P & { children?: ReactNode }, State> {
    constructor(props: P & { children?: ReactNode }) {
      super(props);
      this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
      return { hasError: true, error };
    }

    componentDidCatch(error: Error): void {
      console.error('[withErrorBoundary] Caught error:', error);
    }

    handleReset = (): void => {
      this.setState({ hasError: false, error: null });
    };

    render(): ReactNode {
      if (this.state.hasError) {
        if (fallback) {
          return fallback;
        }
        return <DefaultErrorFallback error={this.state.error} onReset={this.handleReset} />;
      }

      return <WrappedComponent {...(this.props as P)} />;
    }
  };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.bg,
    gap: spacing.md,
  },
  title: {
    color: colors.error,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  message: {
    color: colors.muted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: '80%',
  },
  devError: {
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: 'monospace',
    textAlign: 'center',
    padding: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 8,
    maxWidth: '90%',
  },
  button: {
    backgroundColor: colors.teal,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 12,
    marginTop: spacing.sm,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});

export default withErrorBoundary;